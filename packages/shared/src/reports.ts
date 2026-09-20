import { z } from 'zod'

/** Public report categories (docs/07 §4.1) mapped to stable reason codes. */
export const RIGHTS_REPORT_REASONS = [
  'copyright',
  'likeness',
  'unauthorized_use',
  'fraudulent_release',
  'safety_urgent',
  'compensation_dispute',
  'other',
] as const

export const rightsReportReasonSchema = z.enum(RIGHTS_REPORT_REASONS)
export type RightsReportReason = z.infer<typeof rightsReportReasonSchema>

export const RIGHTS_REPORT_QUEUES = [
  'dmca_copyright',
  'likeness_consent',
  'fraud_strikes',
  'safety',
  'commercial_dispute',
  'general',
] as const
export type RightsReportQueue = (typeof RIGHTS_REPORT_QUEUES)[number]

export const RIGHTS_REPORT_CATEGORY_META: Record<
  RightsReportReason,
  { label: string; description: string; queue: RightsReportQueue; urgent: boolean }
> = {
  copyright: {
    label: 'Copyright infringement',
    description: 'You own or control the photograph and it was uploaded without permission.',
    queue: 'dmca_copyright',
    urgent: false,
  },
  likeness: {
    label: 'Unauthorized use of my image or likeness',
    description: 'You are depicted and did not consent to this use.',
    queue: 'likeness_consent',
    urgent: false,
  },
  unauthorized_use: {
    label: 'Unauthorized commercial use',
    description: 'Licensed or displayed beyond agreed commercial scope.',
    queue: 'likeness_consent',
    urgent: false,
  },
  fraudulent_release: {
    label: 'Fraudulent release or false identity',
    description: 'A release, identity claim, or photographer attestation appears false.',
    queue: 'fraud_strikes',
    urgent: false,
  },
  safety_urgent: {
    label: 'Intimate images, minor safety, or other urgent harm',
    description: 'Safety-critical. Routed to the fast-path queue — not ordinary copyright.',
    queue: 'safety',
    urgent: true,
  },
  compensation_dispute: {
    label: 'Compensation or licensing dispute',
    description: 'Commercial terms, fees, or licence disagreement. May freeze new sales.',
    queue: 'commercial_dispute',
    urgent: false,
  },
  other: {
    label: 'Other rights issue',
    description: 'Something else about rights, consent, or listing integrity.',
    queue: 'general',
    urgent: false,
  },
}

export function reportQueueForReason(reason: RightsReportReason): RightsReportQueue {
  return RIGHTS_REPORT_CATEGORY_META[reason].queue
}

export function reportIsUrgent(reason: RightsReportReason): boolean {
  return RIGHTS_REPORT_CATEGORY_META[reason].urgent
}

/**
 * Resolve a pasted photograph link or bare id to a photo id.
 * Accepts: `afr-001`, `/photo/afr-001`, `https://host/photo/afr-001?…`
 */
export function parsePhotoRef(raw?: string | null): string | null {
  const value = raw?.trim()
  if (!value) return null

  // Absolute or protocol-relative URL
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) {
    try {
      const url = new URL(value.startsWith('//') ? `https:${value}` : value)
      const fromPath = photoIdFromPath(url.pathname)
      if (fromPath) return fromPath
      const fromQuery = url.searchParams.get('photoId') ?? url.searchParams.get('photo')
      if (fromQuery?.trim()) return fromQuery.trim()
    } catch {
      return null
    }
    return null
  }

  // Path or path+query without host
  if (value.includes('/') || value.includes('?')) {
    const pathOnly = value.split('?')[0] ?? value
    const fromPath = photoIdFromPath(pathOnly)
    if (fromPath) return fromPath
    try {
      const url = new URL(value, 'https://vuekumi.local')
      const q = url.searchParams.get('photoId') ?? url.searchParams.get('photo')
      if (q?.trim()) return q.trim()
    } catch {
      /* ignore */
    }
  }

  // Bare id
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)) return value
  return null
}

function photoIdFromPath(pathname: string): string | null {
  const cleaned = pathname.replace(/\/+$/, '')
  const match = cleaned.match(/\/photo\/([^/]+)\/?$/i)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function photoPagePath(photoId: string): string {
  return `/photo/${photoId}`
}

export const rightsReportStatusSchema = z.enum(['open', 'reviewing', 'dismissed', 'resolved'])

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(z.string().email().max(200).optional())

export const createRightsReportSchema = z.object({
  reason: rightsReportReasonSchema,
  details: z.string().trim().min(20, 'Please describe the issue in at least 20 characters').max(4000),
  reporterEmail: optionalEmail,
  reporterName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  /** Preferred: photograph page URL or `/photo/:id` path. */
  photoUrl: z.string().trim().min(1).max(500).optional(),
  /** Bare id (deep-link / legacy). */
  photoId: z.string().min(1).max(64).optional(),
})

export function resolveReportPhotoId(input: { photoUrl?: string | null; photoId?: string | null }): string | null {
  return parsePhotoRef(input.photoUrl) ?? parsePhotoRef(input.photoId)
}

export const decideRightsReportSchema = z.object({
  action: z.enum(['lock', 'unlock', 'dismiss', 'resolve']),
  notes: z.string().trim().max(2000).optional(),
})

export const setCommercialLockSchema = z.object({
  locked: z.boolean(),
  notes: z.string().trim().max(2000).optional(),
})

export type RightsReportStatus = z.infer<typeof rightsReportStatusSchema>
export type CreateRightsReportInput = z.infer<typeof createRightsReportSchema>
export type DecideRightsReportInput = z.infer<typeof decideRightsReportSchema>
export type SetCommercialLockInput = z.infer<typeof setCommercialLockSchema>

export interface RightsReportDto {
  id: string
  photoId: string
  photoTitle: string
  photoSrc: string
  photographer: string
  reason: RightsReportReason
  queue: RightsReportQueue
  urgent: boolean
  details: string
  status: RightsReportStatus
  reporterEmail: string | null
  reporterName: string | null
  reporterUserId: string | null
  createdAt: string
  reviewedAt: string | null
  staffNotes: string | null
  commercialLocked: boolean
}

export interface PublicReportResult {
  ok: true
  alreadyReported?: boolean
  urgent?: boolean
  queue?: RightsReportQueue
}
