import { z } from 'zod'

export const collectionVisibilitySchema = z.enum(['private', 'unlisted', 'public'])

export const createCollectionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  visibility: collectionVisibilitySchema.default('private'),
  shared: z.boolean().optional(),
})

export const updateCollectionSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: collectionVisibilitySchema.optional(),
  shared: z.boolean().optional(),
})

export const addCollectionPhotoSchema = z.object({
  photoId: z.string().min(1).max(40),
})

export type CollectionVisibility = z.infer<typeof collectionVisibilitySchema>
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>
export type AddCollectionPhotoInput = z.infer<typeof addCollectionPhotoSchema>
