import { z } from 'zod'

/**
 * Phase 32 — brand production: campaign-shaped sourcing.
 *
 * A brand (buyer or agency account) posts a campaign brief; contributors pitch;
 * the brand accepts or declines. VueKumi records the brief, the pitches, and
 * the decisions — it does not process production payments and takes no
 * commission (the production commission rate was never decided, see
 * docs/03-PRODUCT-AND-RIGHTS.md §10). Settlement happens directly between the
 * parties, and campaign money never touches the earnings ledger.
 *
 * Accepting a pitch licenses nothing: any photograph delivered or licensed
 * still goes through the normal checkout with every rights guard intact
 * (two-approval commercial lock included).
 */

export const CAMPAIGN_STATUSES = ['open', 'closed'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const PITCH_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn'] as const
export type PitchStatus = (typeof PITCH_STATUSES)[number]

export const createCampaignSchema = z.object({
  title: z.string().min(3).max(160),
  brief: z.string().min(10).max(6000),
  deliverables: z.string().max(2000).optional().or(z.literal('')),
  usage: z.string().max(2000).optional().or(z.literal('')),
  location: z.string().max(160).optional().or(z.literal('')),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  budgetUsd: z.number().min(0).max(10_000_000).optional(),
})
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>

export const createPitchSchema = z.object({
  note: z.string().min(10).max(4000),
  rateUsd: z.number().positive().max(1_000_000).optional(),
})
export type CreatePitchInput = z.infer<typeof createPitchSchema>

export interface CampaignPitchDto {
  id: string
  campaignId: string
  campaignTitle: string
  contributorName: string
  contributorHandle: string | null
  contributorAvatarUrl: string | null
  note: string
  rateUsd: number | null
  status: PitchStatus
  createdAt: string
  respondedAt: string | null
}

export interface CampaignDto {
  id: string
  title: string
  brief: string
  deliverables: string | null
  usage: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
  budgetUsd: number | null
  status: CampaignStatus
  ownerName: string
  mine: boolean
  pitchCount: number
  myPitch: CampaignPitchDto | null
  createdAt: string
}

/** Staff queue view — owner email for contact. Budgets/rates are party-indicated, not fees. */
export interface CampaignAdminDto {
  id: string
  title: string
  brief: string
  deliverables: string | null
  usage: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
  budgetUsd: number | null
  status: CampaignStatus
  ownerName: string
  ownerEmail: string
  pitchCount: number
  pendingPitchCount: number
  createdAt: string
}

/** Why a contributor cannot pitch this campaign, or null when they can. */
export function campaignPitchBlocked(input: {
  campaignFound: boolean
  campaignOpen: boolean
  isOwner: boolean
  isContributor: boolean
  alreadyPitched: boolean
}): { status: number; error: string } | null {
  if (!input.campaignFound) return { status: 404, error: 'Campaign not found' }
  if (!input.isContributor) return { status: 403, error: 'Only contributors can pitch' }
  if (input.isOwner) return { status: 400, error: 'You cannot pitch your own campaign' }
  if (!input.campaignOpen) return { status: 400, error: 'This campaign is closed' }
  if (input.alreadyPitched) return { status: 400, error: 'You already pitched this campaign' }
  return null
}

export type PitchAction = 'accept' | 'decline' | 'withdraw'

/**
 * The brand decides pitches on its own campaign; the contributor can withdraw
 * a pending pitch. Decided pitches are final.
 */
export function pitchActionBlocked(input: {
  action: PitchAction
  status: PitchStatus
  isOwner: boolean
  isContributor: boolean
}): { status: number; error: string } | null {
  const { action, status, isOwner, isContributor } = input
  if (action === 'withdraw') {
    if (!isContributor) return { status: 403, error: 'Only the contributor can withdraw a pitch' }
  } else if (!isOwner) {
    return { status: 403, error: 'Only the campaign owner can decide pitches' }
  }
  if (status !== 'pending') {
    return { status: 400, error: 'This pitch has already been decided' }
  }
  return null
}

/** Owners close their own campaigns; staff can close any (moderation). */
export function campaignCloseBlocked(input: {
  campaignFound: boolean
  campaignOpen: boolean
  isOwner: boolean
  isAdmin: boolean
}): { status: number; error: string } | null {
  if (!input.campaignFound) return { status: 404, error: 'Campaign not found' }
  if (!input.isOwner && !input.isAdmin) {
    return { status: 403, error: 'Only the campaign owner can close it' }
  }
  if (!input.campaignOpen) return { status: 400, error: 'This campaign is already closed' }
  return null
}
