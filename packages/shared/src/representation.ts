import { z } from 'zod'

/**
 * Phase 31 — VueQuatro representation.
 *
 * VueQuatro is the parent rights/agency layer behind VueKumi. Representation is
 * strictly opt-in: a contributor asks for it, staff approve it, and either side
 * can end it. It never transfers copyright, and no representation commission is
 * charged — that rate was never decided (docs/03-PRODUCT-AND-RIGHTS.md §10) and
 * must not be invented. There is no second public app: VueQuatro is a VueKumi
 * staff mode.
 *
 * Only represented contributors can have photographs marked `agency_protected`.
 * Agency-protected inventory is not self-serve stock — buyers send an inquiry
 * that staff handle. When representation ends, agency-protected photographs
 * revert to `portfolio`, returning control to the contributor without
 * inventing any clearance.
 */

export const REPRESENTATION_STATUSES = [
  'requested',
  'represented',
  'declined',
  'ended',
  'withdrawn',
] as const
export type RepresentationStatus = (typeof REPRESENTATION_STATUSES)[number]

export const REPRESENTATION_STATUS_LABELS: Record<RepresentationStatus, string> = {
  requested: 'Requested — staff review pending',
  represented: 'Represented by VueQuatro',
  declined: 'Declined',
  ended: 'Ended',
  withdrawn: 'Withdrawn',
}

export const requestRepresentationSchema = z.object({
  note: z.string().max(2000).optional().or(z.literal('')),
})
export type RequestRepresentationInput = z.infer<typeof requestRepresentationSchema>

export const decideRepresentationSchema = z.object({
  action: z.enum(['approve', 'decline', 'end']),
  staffNote: z.string().max(2000).optional().or(z.literal('')),
})
export type DecideRepresentationInput = z.infer<typeof decideRepresentationSchema>

export const createInquirySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().max(160).optional().or(z.literal('')),
  message: z.string().min(10).max(4000),
})
export type CreateInquiryInput = z.infer<typeof createInquirySchema>

export const INQUIRY_STATUSES = ['new', 'answered', 'closed'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

export const decideInquirySchema = z.object({
  status: z.enum(['answered', 'closed']),
  staffNote: z.string().max(2000).optional().or(z.literal('')),
})
export type DecideInquiryInput = z.infer<typeof decideInquirySchema>

export interface RepresentationDto {
  status: RepresentationStatus
  note: string | null
  staffNote: string | null
  requestedAt: string
  decidedAt: string | null
  endedAt: string | null
}

export interface RepresentationAdminDto extends RepresentationDto {
  id: string
  contributorName: string
  contributorEmail: string
  contributorHandle: string | null
  photosCount: number
  protectedCount: number
}

export interface RepresentationInquiryDto {
  id: string
  photoId: string
  photoTitle: string
  name: string
  email: string
  company: string | null
  message: string
  status: InquiryStatus
  staffNote: string | null
  createdAt: string
}

export type RepresentationAction = 'request' | 'withdraw' | 'end' | 'approve' | 'decline'

/**
 * Full transition matrix. `current` is null when the contributor never asked.
 * Contributors request, withdraw a pending request, or end representation;
 * staff approve or decline pending requests and can also end representation.
 */
export function representationActionBlocked(input: {
  action: RepresentationAction
  current: RepresentationStatus | null
  actor: 'contributor' | 'admin'
}): { status: number; error: string } | null {
  const { action, current, actor } = input
  if ((action === 'approve' || action === 'decline') && actor !== 'admin') {
    return { status: 403, error: 'Only VueKumi staff can decide representation' }
  }
  if ((action === 'request' || action === 'withdraw') && actor !== 'contributor') {
    return { status: 403, error: 'Only the contributor can do that' }
  }
  switch (action) {
    case 'request':
      if (current === 'requested') return { status: 400, error: 'Your request is already pending' }
      if (current === 'represented') return { status: 400, error: 'You are already represented' }
      return null
    case 'withdraw':
      if (current !== 'requested') return { status: 400, error: 'There is no pending request to withdraw' }
      return null
    case 'approve':
    case 'decline':
      if (current !== 'requested') return { status: 400, error: 'There is no pending request to decide' }
      return null
    case 'end':
      if (current !== 'represented') return { status: 400, error: 'This contributor is not represented' }
      return null
  }
}

/** `agency_protected` may only be applied while the contributor is represented. */
export function canMarkAgencyProtected(status: RepresentationStatus | null | undefined): boolean {
  return status === 'represented'
}

/**
 * When representation ends, agency-protected photographs return to the
 * contributor as portfolio-only: visible, not stock, and no clearance invented.
 */
export const AGENCY_PROTECTED_REVERT_STATE = 'portfolio' as const
