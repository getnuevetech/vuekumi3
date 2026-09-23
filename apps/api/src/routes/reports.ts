import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  commercialLockReasonForReport,
  createRightsReportSchema,
  decideRightsReportSchema,
  reportIsUrgent,
  reportQueueForReason,
  resolveReportPhotoId,
  setCommercialLockSchema,
  type RightsReportReason,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { optionalAuthenticate, requireAdminCapability } from '../lib/auth-middleware.js'
import { config } from '../config.js'
import { DEFAULT_OPS_ADDRESS, rightsReportOpsEmail, sendEmail } from '../lib/email.js'
import { appendRightsLedgerEvent } from '../lib/ledger.js'
import { syncVerifiedRightsRecord } from '../lib/models.js'
import { prisma } from '../lib/prisma.js'
import { REPORT_RATE_LIMIT } from '../lib/rate-limit.js'
import {
  applyCommercialLock,
  duplicateReportWhere,
  guestReportMissingContact,
  holdReasonForReport,
  nextReportStatus,
  nextSopStage,
  normalizeReporterEmail,
  OPEN_DMCA_HOLD_STATUSES,
  photoHasOpenDmcaHold,
  reportQueueWhere,
  rightsPatchForReport,
  serializeRightsReport,
} from '../lib/reports.js'
import { getSettingSafe } from '../lib/settings.js'

const reportPhotoInclude = {
  contributor: { include: { contributorProfile: true } },
} as const

async function fileRightsReport(request: FastifyRequest, reply: FastifyReply, photoId: string) {
  const body = createRightsReportSchema.parse(request.body)
  const reason = body.reason as RightsReportReason
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
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
    return {
      ok: true as const,
      alreadyReported: true,
      urgent: duplicate.urgent,
      queue: duplicate.queue,
    }
  }

  const urgent = reportIsUrgent(reason)
  const queue = reportQueueForReason(reason)

  const report = await prisma.rightsReport.create({
    data: {
      photoId: photo.id,
      reason,
      details: body.details,
      urgent,
      queue,
      reporterUserId: request.userId ?? null,
      reporterEmail: reporterEmail ?? null,
      reporterName,
      ipAddress: request.ip,
      userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'].slice(0, 400) : null,
    },
  })

  await applyCommercialLock({
    photoId: photo.id,
    locked: true,
    actorId: request.userId,
    holdReason: holdReasonForReport(reason),
    lockReason: commercialLockReasonForReport(reason),
  })
  const rightsPatch = rightsPatchForReport(reason)
  if (Object.keys(rightsPatch).length) {
    await prisma.rightsRecord.updateMany({
      where: { photoId: photo.id },
      data: { ...rightsPatch, commercialEligible: false },
    })
  }
  await syncVerifiedRightsRecord(photo.id)
  await appendRightsLedgerEvent({
    photoId: photo.id,
    action: 'report.filed',
    actorId: request.userId,
    actorKind: request.userId ? 'user' : 'guest',
    nextCopyright: rightsPatch.copyrightStatus,
    nextLikeness: rightsPatch.modelConsentStatus,
    commercialEligible: false,
    relatedIds: { reportId: report.id, reason, queue, urgent },
    ip: request.ip,
    userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
  })

  await writeAuditLog({
    actorId: request.userId,
    action: urgent ? 'rights.report.urgent' : 'rights.report',
    entityType: 'photo',
    entityId: photo.id,
    metadata: { reportId: report.id, reason, queue, urgent },
    ipAddress: request.ip,
  })

  const ops = (await getSettingSafe('email.ops_address'))?.trim() || DEFAULT_OPS_ADDRESS
  await sendEmail({
    to: ops,
    subject: `${urgent ? '[SAFETY] ' : ''}Rights report: ${photo.title}`,
    html: rightsReportOpsEmail({
      photoTitle: photo.title,
      reason,
      reporterEmail: reporterEmail ?? 'anonymous',
      queueUrl: `${config.webUrl}/admin/reports${urgent ? '?status=safety' : ''}`,
    }),
  })

  return { ok: true as const, urgent, queue }
}

export async function reportRoutes(app: FastifyInstance) {
  const listReports = { preHandler: requireAdminCapability(app, 'reports.list') }
  const decideReports = { preHandler: requireAdminCapability(app, 'reports.decide') }
  const commercialLock = { preHandler: requireAdminCapability(app, 'content.commercial_lock') }

  app.post('/photos/:id/report', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
    config: { rateLimit: REPORT_RATE_LIMIT },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    return fileRightsReport(request, reply, id)
  })

  app.post('/report-content', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
    config: { rateLimit: REPORT_RATE_LIMIT },
  }, async (request, reply) => {
    const body = createRightsReportSchema.parse(request.body)
    const photoId = resolveReportPhotoId(body)
    if (!photoId) {
      return reply.code(400).send({ error: 'Paste the photograph page link (for example /photo/afr-001)' })
    }
    return fileRightsReport(request, reply, photoId)
  })

  app.get('/admin/reports', listReports, async (request) => {
    const query = request.query as { status?: string }
    const items = await prisma.rightsReport.findMany({
      where: reportQueueWhere(query.status),
      include: { photo: { include: reportPhotoInclude } },
      orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
    })
    const photoIds = [...new Set(items.map((r) => r.photoId))]
    const dmcaHolds = photoIds.length
      ? await prisma.dmcaNotice.findMany({
          where: { photoId: { in: photoIds }, status: { in: [...OPEN_DMCA_HOLD_STATUSES] } },
          select: { photoId: true },
        })
      : []
    const holdSet = new Set(dmcaHolds.map((d) => d.photoId))
    return {
      items: items.map((row) => serializeRightsReport(row, { openDmcaHold: holdSet.has(row.photoId) })),
    }
  })

  app.post('/admin/reports/:id/decide', decideReports, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = decideRightsReportSchema.parse(request.body)
    const report = await prisma.rightsReport.findUnique({
      where: { id },
      include: { photo: { include: reportPhotoInclude } },
    })
    if (!report) return reply.code(404).send({ error: 'Report not found' })

    if (body.action === 'escalate' && !body.escalateTo) {
      return reply.code(400).send({ error: 'Escalate requires a target (legal, law_enforcement, counsel, or other)' })
    }

    if (body.action === 'unlock') {
      if (await photoHasOpenDmcaHold(report.photoId)) {
        return reply.code(400).send({
          error: 'Cannot unfreeze while an open DMCA notice holds this photograph. Counter-notice does not clear likeness or safety holds — close or restore the DMCA track first.',
        })
      }
    }

    if (body.action === 'lock' || body.action === 'unlock') {
      await applyCommercialLock({
        photoId: report.photoId,
        locked: body.action === 'lock',
        actorId: request.userId!,
        notes: body.notes,
        holdReason: holdReasonForReport(report.reason as RightsReportReason),
        lockReason: body.action === 'lock'
          ? commercialLockReasonForReport(report.reason as RightsReportReason)
          : null,
      })
    }

    const now = new Date()
    const status = nextReportStatus(body.action, report.status)
    const sopStage = nextSopStage(body.action, report.sopStage)
    const updated = await prisma.rightsReport.update({
      where: { id },
      data: {
        status,
        sopStage,
        staffNotes: body.notes ?? report.staffNotes,
        reviewerId: request.userId,
        reviewedAt: now,
        ...(body.action === 'preserve'
          ? { evidencePreservedAt: now, evidenceNotes: body.notes ?? report.evidenceNotes }
          : {}),
        ...(body.action === 'notify' ? { notifiedAt: now } : {}),
        ...(body.action === 'escalate'
          ? { escalateTo: body.escalateTo!, escalatedAt: now }
          : {}),
      },
      include: { photo: { include: reportPhotoInclude } },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: `rights.report.${body.action}`,
      entityType: 'photo',
      entityId: report.photoId,
      metadata: {
        reportId: id,
        notes: body.notes ?? null,
        escalateTo: body.escalateTo ?? null,
        sopStage,
        commercialLocked: updated.photo.commercialLocked,
      },
      ipAddress: request.ip,
    })

    return {
      report: serializeRightsReport(updated, {
        openDmcaHold: await photoHasOpenDmcaHold(updated.photoId),
      }),
    }
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
      lockReason: body.locked ? (body.reason ?? 'staff_quarantine') : null,
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
      metadata: {
        notes: body.notes ?? null,
        commercialLockReason: updated.commercialLockReason ?? null,
      },
      ipAddress: request.ip,
    })

    return {
      ok: true as const,
      commercialLocked: updated.commercialLocked,
      commercialLockReason: updated.commercialLockReason ?? null,
    }
  })
}
