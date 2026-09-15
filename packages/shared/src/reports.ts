import { z } from 'zod'

export const rightsReportReasonSchema = z.enum(['copyright', 'likeness', 'unauthorized_use', 'other'])
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
})

export const decideRightsReportSchema = z.object({
  action: z.enum(['lock', 'unlock', 'dismiss', 'resolve']),
  notes: z.string().trim().max(2000).optional(),
})

export const setCommercialLockSchema = z.object({
  locked: z.boolean(),
  notes: z.string().trim().max(2000).optional(),
})

export type RightsReportReason = z.infer<typeof rightsReportReasonSchema>
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
}
