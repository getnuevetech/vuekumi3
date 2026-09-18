import { z } from 'zod'

/**
 * Phase 30 — booking: hire a photographer or book a model.
 *
 * VueKumi records the brief, the quote, and the decision. It does not process
 * booking payments and takes no commission — the booking/production commission
 * rate was never decided (see docs/03-PRODUCT-AND-RIGHTS.md §10) and must not
 * be invented. Settlement happens directly between the parties, and booking
 * money never touches the EarningsLedger.
 */

export const bookingKindSchema = z.enum(['photographer', 'model'])
export type BookingKind = z.infer<typeof bookingKindSchema>

export const BOOKING_STATUSES = ['pending', 'quoted', 'accepted', 'declined', 'withdrawn'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const bookingAvailabilitySchema = z.enum(['open', 'limited', 'unavailable'])
export type BookingAvailability = z.infer<typeof bookingAvailabilitySchema>

export const AVAILABILITY_LABELS: Record<BookingAvailability, string> = {
  open: 'Open to bookings',
  limited: 'Limited availability',
  unavailable: 'Not taking bookings',
}

export const createBookingSchema = z.object({
  kind: bookingKindSchema,
  handle: z.string().min(1).max(60),
  title: z.string().min(3).max(160),
  brief: z.string().min(10).max(4000),
  location: z.string().max(160).optional().or(z.literal('')),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  budgetUsd: z.number().min(0).max(1_000_000).optional(),
})
export type CreateBookingInput = z.infer<typeof createBookingSchema>

export const bookingQuoteSchema = z.object({
  quoteUsd: z.number().positive().max(1_000_000),
  note: z.string().max(2000).optional().or(z.literal('')),
})
export type BookingQuoteInput = z.infer<typeof bookingQuoteSchema>

export interface BookingDto {
  id: string
  kind: BookingKind
  status: BookingStatus
  role: 'sent' | 'received'
  title: string
  brief: string
  location: string | null
  startDate: string | null
  endDate: string | null
  budgetUsd: number | null
  quoteUsd: number | null
  quoteNote: string | null
  requesterName: string
  targetName: string
  targetHandle: string
  targetAvatarUrl: string | null
  createdAt: string
  respondedAt: string | null
}

/** Staff queue view — same fields as BookingDto plus party emails. No platform fee. */
export interface BookingAdminDto {
  id: string
  kind: BookingKind
  status: BookingStatus
  title: string
  brief: string
  location: string | null
  startDate: string | null
  endDate: string | null
  budgetUsd: number | null
  quoteUsd: number | null
  quoteNote: string | null
  requesterName: string
  requesterEmail: string
  targetName: string
  targetEmail: string
  targetHandle: string
  targetAvatarUrl: string | null
  createdAt: string
  respondedAt: string | null
}

/** Why a new booking request cannot be created, or null when it can. */
export function bookingCreateBlocked(input: {
  targetFound: boolean
  targetActive: boolean
  availability: BookingAvailability
  isSelf: boolean
}): { status: number; error: string } | null {
  if (!input.targetFound || !input.targetActive) {
    return { status: 404, error: 'Creator not found' }
  }
  if (input.isSelf) {
    return { status: 400, error: 'You cannot book yourself' }
  }
  if (input.availability === 'unavailable') {
    return { status: 400, error: 'This creator is not taking bookings right now' }
  }
  return null
}

export type BookingAction = 'quote' | 'accept' | 'decline' | 'withdraw'

/**
 * The full transition matrix. The target (creator/model) quotes or declines;
 * the requester accepts a priced quote or withdraws. Decided bookings are
 * final — there is no re-open.
 */
export function bookingActionBlocked(input: {
  action: BookingAction
  status: BookingStatus
  isTarget: boolean
  isRequester: boolean
}): { status: number; error: string } | null {
  const { action, status, isTarget, isRequester } = input
  if (action === 'quote' || action === 'decline') {
    if (!isTarget) return { status: 403, error: 'Only the booked creator can respond' }
  } else if (!isRequester) {
    return { status: 403, error: 'Only the requester can do that' }
  }
  if (action === 'quote' && status !== 'pending') {
    return { status: 400, error: 'This request has already been answered' }
  }
  if (action === 'accept' && status !== 'quoted') {
    return { status: 400, error: 'There is no quote to accept yet' }
  }
  if ((action === 'decline' || action === 'withdraw') && status !== 'pending' && status !== 'quoted') {
    return { status: 400, error: 'This booking has already been decided' }
  }
  return null
}
