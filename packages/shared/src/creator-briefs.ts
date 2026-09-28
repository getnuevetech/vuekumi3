import { z } from 'zod'
import { LIBRARY_TIERS } from './library-tiers.js'

export const createCreatorBriefSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().max(4000).optional().default(''),
  category: z.string().trim().max(60).optional().nullable(),
  country: z.string().trim().max(60).optional().nullable(),
  libraryTier: z.enum(LIBRARY_TIERS).optional().nullable(),
  sourceLabel: z.string().trim().max(160).optional().nullable(),
})
export type CreateCreatorBriefInput = z.infer<typeof createCreatorBriefSchema>

export interface CreatorBriefDto {
  id: string
  title: string
  body: string
  category: string | null
  country: string | null
  libraryTier: string | null
  sourceLabel: string | null
  status: string
  createdAt: string
}
