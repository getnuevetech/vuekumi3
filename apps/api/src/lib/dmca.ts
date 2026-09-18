import type { DmcaCounterNotice, DmcaNotice, Photo, User } from '@prisma/client'
import {
  addBusinessDays,
  canRestoreDmcaNotice,
  REPEAT_INFRINGER_POLICY,
  parsePhotoIdFromUrl,
  type DmcaNoticeDto,
  type DmcaNoticeStatus,
  type RightsStrikeDto,
  type RightsStrikeReason,
} from '@vuekumi/shared'
import { writeAuditLog } from './audit.js'
import { appendRightsLedgerEvent } from './ledger.js'
import {
  holdAvailableEarnings,
  holdContributorAvailableEarnings,
  loadHoldSettings,
  releasePhotoHolds,
} from './holds.js'
import { syncVerifiedRightsRecord } from './models.js'
import { prisma } from './prisma.js'
import { applyCommercialLock } from './reports.js'

const noticePhotoInclude = {
  contributor: { include: { contributorProfile: true } },
} as const

export class DmcaError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'DmcaError'
    this.statusCode = statusCode
  }
}

export function resolveNoticePhotoId(input: { photoId?: string; photoUrl?: string }): string | undefined {
  return input.photoId?.trim() || parsePhotoIdFromUrl(input.photoUrl)
}

export function serializeDmcaNotice(
  notice: DmcaNotice & {
    photo?: (Pick<Photo, 'id' | 'title' | 'src' | 'storageKey' | 'processingStatus' | 'commercialLocked'> & {
      contributor?: User & { contributorProfile?: { handle: string } | null }
    }) | null
    counter?: DmcaCounterNotice | null
  },
): DmcaNoticeDto {
  const src = notice.photo
    ? notice.photo.storageKey && notice.photo.processingStatus === 'ready'
      ? `/api/media/${notice.photo.id}/preview`
      : notice.photo.src
    : null
  return {
    id: notice.id,
    photoId: notice.photoId,
    photoTitle: notice.photo?.title ?? null,
    photoSrc: src,
    photographer:
      notice.photo?.contributor?.contributorProfile?.handle
      ?? notice.photo?.contributor?.name
      ?? null,
    claimantName: notice.claimantName,
    claimantEmail: notice.claimantEmail,
    claimantAddress: notice.claimantAddress,
    claimantPhone: notice.claimantPhone,
    workDescription: notice.workDescription,
    originalLocation: notice.originalLocation,
    infringingLocation: notice.infringingLocation,
    signature: notice.signature,
    status: notice.status,
    restoreEligibleAt: notice.restoreEligibleAt?.toISOString() ?? null,
    receivedAt: notice.createdAt.toISOString(),
    reviewedAt: notice.reviewedAt?.toISOString() ?? null,
    staffNotes: notice.staffNotes,
    commercialLocked: notice.photo?.commercialLocked ?? false,
    counter: notice.counter
      ? {
          id: notice.counter.id,
          senderName: notice.counter.senderName,
          senderEmail: notice.counter.senderEmail,
          senderAddress: notice.counter.senderAddress,
          receivedAt: notice.counter.createdAt.toISOString(),
        }
      : null,
  }
}

export async function fileDmcaNotice(input: {
  photoId?: string
  photoUrl?: string
  claimantName: string
  claimantEmail: string
  claimantAddress: string
  claimantPhone?: string
  workDescription: string
  originalLocation: string
  infringingLocation: string
  signature: string
  ip?: string
  userAgent?: string | null
}) {
  const photoId = resolveNoticePhotoId(input)
  const photo = photoId
    ? await prisma.photo.findUnique({
        where: { id: photoId },
        include: noticePhotoInclude,
      })
    : null
  if (photoId && !photo) throw new DmcaError('Photograph not found', 404)

  const notice = await prisma.dmcaNotice.create({
    data: {
      photoId: photo?.id ?? null,
      photoUrl: input.photoUrl ?? null,
      claimantName: input.claimantName,
      claimantEmail: input.claimantEmail.trim().toLowerCase(),
      claimantAddress: input.claimantAddress,
      claimantPhone: input.claimantPhone ?? null,
      workDescription: input.workDescription,
      originalLocation: input.originalLocation,
      infringingLocation: input.infringingLocation,
      signature: input.signature,
      status: 'processing',
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
    include: { photo: { include: noticePhotoInclude }, counter: true },
  })

  if (photo) {
    await applyCommercialLock({
      photoId: photo.id,
      locked: true,
      holdReason: 'dmca_notice',
    })
    await prisma.rightsRecord.updateMany({
      where: { photoId: photo.id },
      data: { copyrightStatus: 'disputed', commercialEligible: false },
    })
    await syncVerifiedRightsRecord(photo.id)
    await holdAvailableEarnings({ photoIds: [photo.id], reason: 'dmca_notice' })
    await appendRightsLedgerEvent({
      photoId: photo.id,
      action: 'dmca.notice',
      actorKind: 'guest',
      nextCopyright: 'disputed',
      commercialEligible: false,
      relatedIds: { noticeId: notice.id },
      ip: input.ip,
      userAgent: input.userAgent,
    })
  }

  return serializeDmcaNotice(notice)
}

export async function fileCounterNotice(input: {
  noticeId: string
  senderName: string
  senderEmail: string
  senderAddress: string
  senderPhone?: string
  statement: string
  signature: string
  ip?: string
}) {
  const notice = await prisma.dmcaNotice.findUnique({
    where: { id: input.noticeId },
    include: { counter: true, photo: { include: noticePhotoInclude } },
  })
  if (!notice) throw new DmcaError('Notice not found', 404)
  if (notice.counter) throw new DmcaError('A counter-notice is already stored')
  if (notice.status === 'rejected' || notice.status === 'closed' || notice.status === 'restored') {
    throw new DmcaError('This notice is closed')
  }

  const settings = await loadHoldSettings()
  const restoreEligibleAt = addBusinessDays(new Date(), settings.counterWaitDays)
  const counter = await prisma.dmcaCounterNotice.create({
    data: {
      noticeId: notice.id,
      senderName: input.senderName,
      senderEmail: input.senderEmail.trim().toLowerCase(),
      senderAddress: input.senderAddress,
      senderPhone: input.senderPhone ?? null,
      statement: input.statement,
      signature: input.signature,
      ipAddress: input.ip ?? null,
    },
  })
  const updated = await prisma.dmcaNotice.update({
    where: { id: notice.id },
    data: {
      status: 'counter_received',
      restoreEligibleAt,
    },
    include: { photo: { include: noticePhotoInclude }, counter: true },
  })
  if (notice.photoId) {
    await appendRightsLedgerEvent({
      photoId: notice.photoId,
      action: 'dmca.counter_notice',
      actorKind: 'guest',
      relatedIds: { noticeId: notice.id, counterId: counter.id },
      ip: input.ip,
    })
  }
  return serializeDmcaNotice({ ...updated, counter })
}

export async function decideDmcaNotice(input: {
  noticeId: string
  action: 'process' | 'reject' | 'close' | 'restore'
  notes?: string
  actorId: string
}) {
  const notice = await prisma.dmcaNotice.findUnique({
    where: { id: input.noticeId },
    include: { photo: { include: noticePhotoInclude }, counter: true },
  })
  if (!notice) throw new DmcaError('Notice not found', 404)

  let status: DmcaNoticeStatus = notice.status
  if (input.action === 'process') status = notice.counter ? 'counter_received' : 'processing'
  if (input.action === 'reject') status = 'rejected'
  if (input.action === 'close') status = 'closed'
  if (input.action === 'restore') {
    const blocked = canRestoreDmcaNotice({
      status: notice.status,
      restoreEligibleAt: notice.restoreEligibleAt,
    })
    if (blocked) throw new DmcaError(blocked)
    status = 'restored'
    if (notice.photoId) {
      await applyCommercialLock({
        photoId: notice.photoId,
        locked: false,
        actorId: input.actorId,
      })
      await prisma.rightsRecord.updateMany({
        where: { photoId: notice.photoId, copyrightStatus: 'disputed' },
        data: { copyrightStatus: 'claimed', commercialEligible: false },
      })
      await syncVerifiedRightsRecord(notice.photoId)
      await releasePhotoHolds(notice.photoId, 'dmca_notice')
      await appendRightsLedgerEvent({
        photoId: notice.photoId,
        action: 'dmca.restore',
        actorId: input.actorId,
        actorKind: 'staff',
        nextCopyright: 'claimed',
        relatedIds: { noticeId: notice.id },
      })
    }
  }

  const updated = await prisma.dmcaNotice.update({
    where: { id: notice.id },
    data: {
      status,
      staffNotes: input.notes ?? notice.staffNotes,
      reviewerId: input.actorId,
      reviewedAt: new Date(),
    },
    include: { photo: { include: noticePhotoInclude }, counter: true },
  })
  return serializeDmcaNotice(updated)
}

export async function recordRightsStrike(input: {
  userId: string
  reason: RightsStrikeReason
  notes: string
  photoId?: string
  noticeId?: string
  actorId: string
}): Promise<RightsStrikeDto> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } })
  if (!user) throw new DmcaError('Account not found', 404)
  if (user.accountType === 'admin') throw new DmcaError('Staff accounts are not terminated through this strike path')

  const settings = await loadHoldSettings()
  const strike = await prisma.$transaction(async (tx) => {
    const created = await tx.rightsStrike.create({
      data: {
        userId: input.userId,
        reason: input.reason,
        notes: input.notes,
        photoId: input.photoId,
        noticeId: input.noticeId,
        actorId: input.actorId,
      },
    })
    const count = await tx.rightsStrike.count({ where: { userId: input.userId } })
    const terminate = count >= settings.repeatInfringerThreshold
    await tx.user.update({
      where: { id: input.userId },
      data: {
        rightsStrikeCount: count,
        ...(terminate
          ? { status: 'suspended', repeatInfringerAt: new Date() }
          : {}),
      },
    })
    return { created, count, terminate }
  })

  if (strike.terminate) {
    const photos = await prisma.photo.findMany({
      where: { contributorId: input.userId },
      select: { id: true },
    })
    for (const photo of photos) {
      await applyCommercialLock({
        photoId: photo.id,
        locked: true,
        actorId: input.actorId,
        holdReason: 'repeat_infringer',
      })
    }
    await holdContributorAvailableEarnings({
      contributorId: input.userId,
      reason: 'repeat_infringer',
    })
  }

  if (input.photoId) {
    await appendRightsLedgerEvent({
      photoId: input.photoId,
      action: 'rights.strike',
      actorId: input.actorId,
      actorKind: 'staff',
      relatedIds: { strikeId: strike.created.id, reason: input.reason, terminated: strike.terminate },
    })
  }
  await writeAuditLog({
    actorId: input.actorId,
    action: strike.terminate ? 'rights.repeat_infringer' : 'rights.strike',
    entityType: 'user',
    entityId: input.userId,
    metadata: { reason: input.reason, strikeCount: strike.count, photoId: input.photoId ?? null },
  })

  return {
    id: strike.created.id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    reason: input.reason,
    photoId: input.photoId ?? null,
    noticeId: input.noticeId ?? null,
    notes: input.notes,
    createdAt: strike.created.createdAt.toISOString(),
    strikeCount: strike.count,
    terminated: strike.terminate,
  }
}

export { REPEAT_INFRINGER_POLICY }
