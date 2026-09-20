import type { Photo, Prisma, RightsReport, User } from '@prisma/client'
import type { EarningsHoldReason, RightsReportDto, RightsReportQueue, RightsReportReason, RightsReportStatus } from '@vuekumi/shared'
import { reportIsUrgent, reportQueueForReason } from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { COMMERCIAL_LOCK_REASON } from './rights.js'
import { holdAvailableEarnings } from './holds.js'

export { COMMERCIAL_LOCK_REASON }

export const OPEN_REPORT_STATUSES: RightsReportStatus[] = ['open', 'reviewing']

export function normalizeReporterEmail(email?: string | null): string | undefined {
  const trimmed = email?.trim().toLowerCase()
  return trimmed || undefined
}

export function guestReportMissingContact(input: { userId?: string | null; email?: string | null }): boolean {
  return !input.userId && !normalizeReporterEmail(input.email)
}

export function nextReportStatus(
  action: 'lock' | 'unlock' | 'dismiss' | 'resolve',
  current: RightsReportStatus,
): RightsReportStatus {
  if (action === 'dismiss') return 'dismissed'
  if (action === 'resolve') return 'resolved'
  if (action === 'lock' && current === 'open') return 'reviewing'
  return current
}

export function parseReportQueueStatus(raw?: string): RightsReportStatus | undefined {
  if (!raw) return undefined
  if (raw === 'open' || raw === 'reviewing' || raw === 'dismissed' || raw === 'resolved') return raw
  return undefined
}

export function reportQueueWhere(raw?: string): Prisma.RightsReportWhereInput | undefined {
  if (!raw || raw === 'all') return undefined
  if (raw === 'queue') return { status: { in: OPEN_REPORT_STATUSES } }
  if (raw === 'safety' || raw === 'urgent') return { urgent: true, status: { in: OPEN_REPORT_STATUSES } }
  if (
    raw === 'dmca_copyright'
    || raw === 'likeness_consent'
    || raw === 'fraud_strikes'
    || raw === 'commercial_dispute'
    || raw === 'general'
  ) {
    return { queue: raw, status: { in: OPEN_REPORT_STATUSES } }
  }
  const status = parseReportQueueStatus(raw)
  return status ? { status } : undefined
}

export function holdReasonForReport(reason: RightsReportReason): EarningsHoldReason {
  if (reason === 'safety_urgent') return 'safety_urgent'
  if (reason === 'likeness' || reason === 'unauthorized_use' || reason === 'fraudulent_release') {
    return 'likeness_dispute'
  }
  if (reason === 'compensation_dispute') return 'copyright_dispute'
  return 'copyright_dispute'
}

export function rightsPatchForReport(reason: RightsReportReason): {
  copyrightStatus?: 'disputed'
  modelConsentStatus?: 'disputed'
} {
  if (reason === 'copyright' || reason === 'unauthorized_use' || reason === 'fraudulent_release') {
    return { copyrightStatus: 'disputed' }
  }
  if (reason === 'likeness' || reason === 'safety_urgent') {
    return { modelConsentStatus: 'disputed' }
  }
  return {}
}

export function duplicateReportWhere(input: {
  photoId: string
  userId?: string | null
  email?: string | null
  ipAddress?: string | null
}): Prisma.RightsReportWhereInput {
  const or: Prisma.RightsReportWhereInput[] = []
  if (input.userId) or.push({ reporterUserId: input.userId })
  const email = normalizeReporterEmail(input.email)
  if (email) or.push({ reporterEmail: email })
  if (input.ipAddress) or.push({ ipAddress: input.ipAddress })
  return {
    photoId: input.photoId,
    status: { in: OPEN_REPORT_STATUSES },
    ...(or.length > 0 ? { OR: or } : { id: '__none__' }),
  }
}

export function serializeRightsReport(
  report: RightsReport & {
    photo: Pick<Photo, 'id' | 'title' | 'src' | 'storageKey' | 'processingStatus' | 'commercialLocked'> & {
      contributor?: User & { contributorProfile?: { handle: string } | null }
    }
  },
): RightsReportDto {
  const src =
    report.photo.storageKey && report.photo.processingStatus === 'ready'
      ? `/api/media/${report.photo.id}/preview`
      : report.photo.src
  const reason = report.reason as RightsReportReason
  return {
    id: report.id,
    photoId: report.photoId,
    photoTitle: report.photo.title,
    photoSrc: src,
    photographer:
      report.photo.contributor?.contributorProfile?.handle ?? report.photo.contributor?.name ?? '',
    reason,
    queue: (report.queue as RightsReportQueue) || reportQueueForReason(reason),
    urgent: report.urgent || reportIsUrgent(reason),
    details: report.details,
    status: report.status,
    reporterEmail: report.reporterEmail,
    reporterName: report.reporterName,
    reporterUserId: report.reporterUserId,
    createdAt: report.createdAt.toISOString(),
    reviewedAt: report.reviewedAt?.toISOString() ?? null,
    staffNotes: report.staffNotes,
    commercialLocked: report.photo.commercialLocked,
  }
}

export async function applyCommercialLock(input: {
  photoId: string
  locked: boolean
  actorId?: string | null
  notes?: string | null
  holdReason?: EarningsHoldReason
}): Promise<Photo> {
  const photo = await prisma.photo.update({
    where: { id: input.photoId },
    data: input.locked
      ? {
          commercialLocked: true,
          commercialLockedAt: new Date(),
          commercialLockedById: input.actorId || null,
        }
      : {
          commercialLocked: false,
          commercialLockedAt: null,
          commercialLockedById: null,
        },
  })
  if (input.locked) {
    await holdAvailableEarnings({
      photoIds: [input.photoId],
      reason: input.holdReason ?? 'copyright_dispute',
    })
  }
  return photo
}
