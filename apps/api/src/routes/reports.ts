import type { FastifyInstance } from 'fastify'
import {
  createRightsReportSchema,
  decideRightsReportSchema,
  setCommercialLockSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { optionalAuthenticate, requireAdminCapability } from '../lib/auth-middleware.js'
import { config } from '../config.js'
import { DEFAULT_OPS_ADDRESS, rightsReportOpsEmail, sendEmail } from '../lib/email.js'
import { prisma } from '../lib/prisma.js'
import { REPORT_RATE_LIMIT } from '../lib/rate-limit.js'
import {
  applyCommercialLock,
  duplicateReportWhere,
  guestReportMissingContact,
  nextReportStatus,
  normalizeReporterEmail,
  reportQueueWhere,
  serializeRightsReport,
} from '../lib/reports.js'
import { getSettingSafe } from '../lib/settings.js'

const reportPhotoInclude = {
  contributor: { include: { contributorProfile: true } },
} as const

export async function reportRoutes(app: FastifyInstance) {
  const listReports = { preHandler: requireAdminCapability(app, 'reports.list') }
  const decideReports = { preHandler: requireAdminCapability(app, 'reports.decide') }
  const commercialLock = { preHandler: requireAdminCapability(app, 'content.commercial_lock') }

  app.post('/photos/:id/report', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
    config: { rateLimit: REPORT_RATE_LIMIT },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createRightsReportSchema.parse(request.body)
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    })
    if (!photo || photo.status !== 'active') {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    const reporterEmail =
      normalizeReporterEmail(request.authUser?.email) ?? normalizeReporterEmail(body.reporterEmail)
    const reporterName = (request.authUser?.name ?? body.reporterName)?.trim() || null

    if (guestReportMissingContact({ userId: request.userId, email: reporterEmail })) {
      return reply.code(400).send({ error: 'Email is required so staff can follow up' })
    }

    const duplicate = await prisma.rightsReport.findFirst({
      where: duplicateReportWhere({
        photoId: photo.id,
        userId: request.userId,
        email: reporterEmail,
        ipAddress: request.ip,
      }),
      orderBy: { createdAt: 'desc' },
    })
    if (duplicate) {
      return { ok: true as const, alreadyReported: true }
    }

    const report = await prisma.rightsReport.create({
      data: {
        photoId: photo.id,
        reason: body.reason,
        details: body.details,
        reporterUserId: request.userId ?? null,
        reporterEmail: reporterEmail ?? null,
        reporterName,
        ipAddress: request.ip,
        userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'].slice(0, 400) : null,
      },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'rights.report',
      entityType: 'photo',
      entityId: photo.id,
      metadata: { reportId: report.id, reason: body.reason },
      ipAddress: request.ip,
    })

    const ops = (await getSettingSafe('email.ops_address'))?.trim() || DEFAULT_OPS_ADDRESS
    await sendEmail({
      to: ops,
      subject: `Rights report: ${photo.title}`,
      html: rightsReportOpsEmail({
        photoTitle: photo.title,
        reason: body.reason,
        reporterEmail: reporterEmail ?? 'anonymous',
        queueUrl: `${config.webUrl}/admin/reports`,
      }),
    })

    return { ok: true as const }
  })

  app.get('/admin/reports', listReports, async (request) => {
    const query = request.query as { status?: string }
    const items = await prisma.rightsReport.findMany({
      where: reportQueueWhere(query.status),
      include: { photo: { include: reportPhotoInclude } },
      orderBy: [{ createdAt: 'desc' }],
    })
    return { items: items.map(serializeRightsReport) }
  })

  app.post('/admin/reports/:id/decide', decideReports, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = decideRightsReportSchema.parse(request.body)
    const report = await prisma.rightsReport.findUnique({
      where: { id },
      include: { photo: { include: reportPhotoInclude } },
    })
    if (!report) return reply.code(404).send({ error: 'Report not found' })

    if (body.action === 'lock' || body.action === 'unlock') {
      await applyCommercialLock({
        photoId: report.photoId,
        locked: body.action === 'lock',
        actorId: request.userId!,
        notes: body.notes,
      })
    }

    const status = nextReportStatus(body.action, report.status)
    const updated = await prisma.rightsReport.update({
      where: { id },
      data: {
        status,
        staffNotes: body.notes ?? report.staffNotes,
        reviewerId: request.userId,
        reviewedAt: new Date(),
      },
      include: { photo: { include: reportPhotoInclude } },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: `rights.report.${body.action}`,
      entityType: 'photo',
      entityId: report.photoId,
      metadata: { reportId: id, notes: body.notes ?? null, commercialLocked: updated.photo.commercialLocked },
      ipAddress: request.ip,
    })

    return { report: serializeRightsReport(updated) }
  })

  app.post('/admin/content/:id/commercial-lock', commercialLock, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = setCommercialLockSchema.parse(request.body)
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    const updated = await applyCommercialLock({
      photoId: id,
      locked: body.locked,
      actorId: request.userId!,
      notes: body.notes,
    })

    if (body.locked) {
      await prisma.rightsReport.updateMany({
        where: { photoId: id, status: 'open' },
        data: {
          status: 'reviewing',
          reviewerId: request.userId,
          reviewedAt: new Date(),
          staffNotes: body.notes,
        },
      })
    }

    await writeAuditLog({
      actorId: request.userId,
      action: body.locked ? 'rights.commercial_lock' : 'rights.commercial_unlock',
      entityType: 'photo',
      entityId: id,
      metadata: { notes: body.notes ?? null },
      ipAddress: request.ip,
    })

    return { ok: true as const, commercialLocked: updated.commercialLocked }
  })
}
