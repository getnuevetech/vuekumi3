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
  photoId: z.string().min(1).max(64).optional(),
})

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
