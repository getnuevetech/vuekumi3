import { z } from 'zod'
import { permissionStateSchema } from './permissions.js'

export const PHOTO_CATEGORIES = [
  'People',
  'Model',
  'Wildlife',
  'Landscape',
  'Urban',
  'Culture',
  'Food & Craft',
  'Coast',
  'Fashion',
  'Architecture',
] as const

/**
 * Phase 58 — the fixed set of AI functions the provider registry dispatches
 * on. `image_analysis` and `likeness_matching` have callers.
 * `image_remediation` has a caller (Phase 62, quarantine and opt-in preview).
 * `analytics_reporting` is resolved by the read-only catalog summary (Phase 63).
 * `id_verification` (Phase 60, Dec-Bio) stays a registry value until that
 * decision is signed.
 */
export const AI_PROVIDER_PURPOSES = [
  'image_analysis',
  'image_remediation',
  'id_verification',
  'likeness_matching',
  'analytics_reporting',
] as const
export type AiProviderPurpose = (typeof AI_PROVIDER_PURPOSES)[number]

export const AI_PROVIDER_PURPOSE_LABELS: Record<AiProviderPurpose, string> = {
  image_analysis: 'Image analysis (tagging, description, subject flag)',
  image_remediation: 'Image remediation (quality/enhancement, quarantine)',
  id_verification: 'ID verification (government ID ↔ avatar match)',
  likeness_matching: 'Likeness matching (selfie ↔ photo comparison)',
  analytics_reporting: 'Analytics reporting (read-only views, favorites, licences)',
}

export const applyAiFieldsSchema = z.object({
  fields: z
    .array(z.enum(['title', 'description', 'category', 'country', 'tags', 'hasRecognizablePeople']))
    .min(1)
    .max(6),
})

export const suggestFileSchema = z.object({
  imageBase64: z.string().min(20).max(12_000_000),
  mimeType: z.string().min(3).max(80),
  filename: z.string().max(200).optional(),
  title: z.string().max(160).optional(),
  country: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
})

export const updatePhotoSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().min(1).max(80).optional(),
  country: z.string().min(2).max(80).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  hasRecognizablePeople: z.boolean().optional(),
  licenseType: z.enum(['free', 'premium']).optional(),
  price: z.number().min(0).max(10000).optional(),
  exclusiveAvailable: z.boolean().optional(),
  permissionState: permissionStateSchema.optional(),
  restrictionNotes: z.string().trim().max(2000).optional().nullable(),
  copyrightHolder: z.string().min(2).max(200).optional(),
  copyrightAiTraining: z.boolean().optional(),
  status: z.enum(['delisted', 'pending']).optional(),
  modelReleaseFileName: z.string().max(200).optional(),
  modelReleaseNotes: z.string().max(2000).optional(),
})

export type ApplyAiFieldsInput = z.infer<typeof applyAiFieldsSchema>
export type SuggestFileInput = z.infer<typeof suggestFileSchema>
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>
