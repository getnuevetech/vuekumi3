import { z } from 'zod'

export const PHOTO_CATEGORIES = [
  'People',
  'Wildlife',
  'Landscape',
  'Urban',
  'Culture',
  'Food & Craft',
  'Coast',
  'Fashion',
  'Architecture',
] as const

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
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(80).optional(),
  country: z.string().min(2).max(80).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  hasRecognizablePeople: z.boolean().optional(),
})

export type ApplyAiFieldsInput = z.infer<typeof applyAiFieldsSchema>
export type SuggestFileInput = z.infer<typeof suggestFileSchema>
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>
