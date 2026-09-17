import type { FastifyInstance } from 'fastify'
import {
  AGENCY_PROTECTED_REVERT_STATE,
  createInquirySchema,
  decideInquirySchema,
  decideRepresentationSchema,
  representationActionBlocked,
  requestRepresentationSchema,
} from '@vuekumi/shared'
import type {
  RepresentationAdminDto,
  RepresentationDto,
  RepresentationInquiryDto,
} from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import { optionalAuthenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import {
  DEFAULT_OPS_ADDRESS,
  representationDecisionEmail,
  representationInquiryOpsEmail,
  representationRequestOpsEmail,
  sendEmail,
} from '../lib/email.js'
import { prisma } from '../lib/prisma.js'
import { REPORT_RATE_LIMIT } from '../lib/rate-limit.js'
import { getSettingSafe } from '../lib/settings.js'

type RepresentationRow = {
  status: 'requested' | 'represented' | 'declined' | 'ended' | 'withdrawn'
  note: string | null
  staffNote: string | null
  requestedAt: Date
  decidedAt: Date | null
  endedAt: Date | null
}

function serializeRepresentation(row: RepresentationRow): RepresentationDto {
  return {
    status: row.status,
    note: row.note,
    staffNote: row.staffNote,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  }
}

async function opsAddress(): Promise<string> {
  return (await getSettingSafe('email.ops_address'))?.trim() || DEFAULT_OPS_ADDRESS
}

/**
 * Ending representation returns agency-protected photographs to the
 * contributor as portfolio-only. No clearance is invented — the contributor
 * re-licences through the normal editor with all guards intact.
 */
async function revertProtectedPhotos(contributorId: string): Promise<number> {
  const result = await prisma.photo.updateMany({
    where: { contributorId, permissionState: 'agency_protected' },
    data: { permissionState: AGENCY_PROTECTED_REVERT_STATE, exclusiveAvailable: false },
  })
  return result.count
}

export async function representationRoutes(app: FastifyInstance) {
  const contributor = { preHandler: requireAccountTypes(app, 'photographer', 'contributor') }
  const admin = { preHandler: requireAccountTypes(app, 'admin') }

  app.get('/representation', contributor, async (request) => {
    const row = await prisma.representation.findUnique({
      where: { contributorId: request.userId! },
    })
    return { representation: row ? serializeRepresentation(row) : null }
  })

  app.post('/representation', contributor, async (request, reply) => {
    const body = requestRepresentationSchema.parse(request.body)
    const existing = await prisma.representation.findUnique({
      where: { contributorId: request.userId! },
    })

    const blocked = representationActionBlocked({
      action: 'request',
      current: existing?.status ?? null,
      actor: 'contributor',
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const note = body.note?.trim() || null
    const row = await prisma.representation.upsert({
      where: { contributorId: request.userId! },
      create: { contributorId: request.userId!, note },
      update: { status: 'requested', note, staffNote: null, requestedAt: new Date(), decidedAt: null, endedAt: null },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'representation.request',
      entityType: 'representation',
      entityId: row.id,
      ipAddress: request.ip,
    })

    await sendEmail({
      to: await opsAddress(),
      subject: 'VueQuatro representation request',
      html: representationRequestOpsEmail({
        contributorName: request.authUser!.name,
        contributorEmail: request.authUser!.email,
        note,
        queueUrl: `${config.webUrl}/admin/representation`,
      }),
    })

    return { representation: serializeRepresentation(row) }
  })

  app.post('/representation/withdraw', contributor, async (request, reply) => {
    const existing = await prisma.representation.findUnique({
      where: { contributorId: request.userId! },
    })
    const blocked = representationActionBlocked({
      action: 'withdraw',
      current: existing?.status ?? null,
      actor: 'contributor',
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const row = await prisma.representation.update({
      where: { contributorId: request.userId! },
      data: { status: 'withdrawn', endedAt: new Date() },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'representation.withdraw',
      entityType: 'representation',
      entityId: row.id,
      ipAddress: request.ip,
    })
    return { representation: serializeRepresentation(row) }
  })

  app.post('/representation/end', contributor, async (request, reply) => {
    const existing = await prisma.representation.findUnique({
      where: { contributorId: request.userId! },
    })
    const blocked = representationActionBlocked({
      action: 'end',
      current: existing?.status ?? null,
      actor: 'contributor',
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const row = await prisma.representation.update({
      where: { contributorId: request.userId! },
      data: { status: 'ended', endedAt: new Date() },
    })
    const reverted = await revertProtectedPhotos(request.userId!)

    await writeAuditLog({
      actorId: request.userId,
      action: 'representation.end',
      entityType: 'representation',
      entityId: row.id,
      metadata: { revertedPhotos: reverted },
      ipAddress: request.ip,
    })
    return { representation: serializeRepresentation(row), revertedPhotos: reverted }
  })

  app.post('/photos/:id/inquiry', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
    config: { rateLimit: REPORT_RATE_LIMIT },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createInquirySchema.parse(request.body)
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, permissionState: true },
    })
    if (!photo || photo.status !== 'active') {
      return reply.code(404).send({ error: 'Photo not found' })
    }
    if (photo.permissionState !== 'agency_protected') {
      return reply.code(400).send({ error: 'This photograph is licensed through normal checkout' })
    }

    const inquiry = await prisma.representationInquiry.create({
      data: {
        photoId: photo.id,
        requesterId: request.userId ?? null,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        company: body.company?.trim() || null,
        message: body.message.trim(),
        ipAddress: request.ip,
      },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'representation.inquiry',
      entityType: 'representation_inquiry',
      entityId: inquiry.id,
      metadata: { photoId: photo.id },
      ipAddress: request.ip,
    })

    await sendEmail({
      to: await opsAddress(),
      subject: `Agency-protected inquiry: ${photo.title}`,
      html: representationInquiryOpsEmail({
        photoTitle: photo.title,
        name: inquiry.name,
        email: inquiry.email,
        company: inquiry.company,
        message: inquiry.message,
        queueUrl: `${config.webUrl}/admin/representation`,
      }),
    })

    return { ok: true as const }
  })

  app.get('/admin/representation', admin, async () => {
    const [rows, inquiries] = await Promise.all([
      prisma.representation.findMany({
        where: { status: { in: ['requested', 'represented'] } },
        include: {
          contributor: {
            select: {
              name: true,
              email: true,
              contributorProfile: { select: { handle: true, photosCount: true } },
              _count: { select: { photos: { where: { permissionState: 'agency_protected' } } } },
            },
          },
        },
        orderBy: { requestedAt: 'asc' },
      }),
      prisma.representationInquiry.findMany({
        where: { status: { not: 'closed' } },
        include: { photo: { select: { title: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const items: RepresentationAdminDto[] = rows.map((row) => ({
      ...serializeRepresentation(row),
      id: row.id,
      contributorName: row.contributor.name,
      contributorEmail: row.contributor.email,
      contributorHandle: row.contributor.contributorProfile?.handle ?? null,
      photosCount: row.contributor.contributorProfile?.photosCount ?? 0,
      protectedCount: row.contributor._count.photos,
    }))
    const inquiryItems: RepresentationInquiryDto[] = inquiries.map((q) => ({
      id: q.id,
      photoId: q.photoId,
      photoTitle: q.photo.title,
      name: q.name,
      email: q.email,
      company: q.company,
      message: q.message,
      status: q.status,
      staffNote: q.staffNote,
      createdAt: q.createdAt.toISOString(),
    }))
    return { items, inquiries: inquiryItems }
  })

  app.post('/admin/representation/:id/decide', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = decideRepresentationSchema.parse(request.body)
    const row = await prisma.representation.findUnique({
      where: { id },
      include: { contributor: { select: { id: true, name: true, email: true } } },
    })
    if (!row) return reply.code(404).send({ error: 'Representation record not found' })

    const blocked = representationActionBlocked({
      action: body.action,
      current: row.status,
      actor: 'admin',
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const staffNote = body.staffNote?.trim() || null
    const now = new Date()
    const updated = await prisma.representation.update({
      where: { id },
      data:
        body.action === 'approve'
          ? { status: 'represented', staffNote, decidedAt: now }
          : body.action === 'decline'
            ? { status: 'declined', staffNote, decidedAt: now }
            : { status: 'ended', staffNote, endedAt: now },
    })
    const reverted = body.action === 'end' ? await revertProtectedPhotos(row.contributor.id) : 0

    await writeAuditLog({
      actorId: request.userId,
      action: `representation.${body.action}`,
      entityType: 'representation',
      entityId: id,
      metadata: { contributorId: row.contributor.id, revertedPhotos: reverted },
      ipAddress: request.ip,
    })

    await sendEmail({
      to: row.contributor.email,
      subject: 'VueQuatro representation update',
      html: representationDecisionEmail({
        name: row.contributor.name,
        decision: body.action === 'approve' ? 'approved' : body.action === 'decline' ? 'declined' : 'ended',
        staffNote,
        dashboardUrl: `${config.webUrl}/contributor`,
      }),
    })

    return { representation: serializeRepresentation(updated), revertedPhotos: reverted }
  })

  app.post('/admin/inquiries/:id', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = decideInquirySchema.parse(request.body)
    const inquiry = await prisma.representationInquiry.findUnique({ where: { id } })
    if (!inquiry) return reply.code(404).send({ error: 'Inquiry not found' })

    await prisma.representationInquiry.update({
      where: { id },
      data: { status: body.status, ...(body.staffNote !== undefined ? { staffNote: body.staffNote?.trim() || null } : {}) },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: `representation.inquiry_${body.status}`,
      entityType: 'representation_inquiry',
      entityId: id,
      ipAddress: request.ip,
    })
    return { ok: true as const }
  })
}
