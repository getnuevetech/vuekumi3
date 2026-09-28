import { z } from 'zod'

/**
 * Brand Studio — buyer creative workspace.
 *
 * Groups a creative brief (notes), optional production campaign, and reference
 * lightboxes (collections) for brand/agency buyers. Distinct from Phase 32
 * Campaigns (sourcing/pitches) and Phase 30 Hire (1:1 booking).
 *
 * Settlement and licensing stay elsewhere: attaching a collection or linking a
 * campaign grants no licence and invents no production fee.
 */

export const BRAND_PROJECT_STATUSES = ['open', 'closed'] as const
export type BrandProjectStatus = (typeof BRAND_PROJECT_STATUSES)[number]

export const createBrandProjectSchema = z.object({
  title: z.string().trim().min(3).max(160),
  notes: z.string().trim().max(6000).optional().or(z.literal('')),
  campaignId: z.string().min(1).max(64).optional().or(z.literal('')),
})
export type CreateBrandProjectInput = z.infer<typeof createBrandProjectSchema>

export const updateBrandProjectSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  notes: z.string().trim().max(6000).optional().nullable(),
  campaignId: z.string().min(1).max(64).optional().nullable().or(z.literal('')),
})
export type UpdateBrandProjectInput = z.infer<typeof updateBrandProjectSchema>

export const attachBrandCollectionSchema = z.object({
  collectionId: z.string().min(1).max(64),
})
export type AttachBrandCollectionInput = z.infer<typeof attachBrandCollectionSchema>

export interface BrandProjectCollectionDto {
  id: string
  name: string
  photoCount: number
  shareToken: string
}

export interface BrandProjectDto {
  id: string
  title: string
  notes: string | null
  status: BrandProjectStatus
  campaignId: string | null
  campaignTitle: string | null
  collections: BrandProjectCollectionDto[]
  createdAt: string
  updatedAt: string
}

export function brandProjectCloseBlocked(status: BrandProjectStatus): string | null {
  if (status === 'closed') return 'Project is already closed'
  return null
}

export function brandProjectEditBlocked(status: BrandProjectStatus): string | null {
  if (status === 'closed') return 'Closed projects cannot be edited'
  return null
}
