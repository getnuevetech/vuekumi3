import { z } from 'zod'
import { bookingAvailabilitySchema, type BookingAvailability } from './bookings.js'

/**
 * Hire expansion — talent discovery for Phase 30 bookings.
 *
 * Browse open/limited creators and jump into the existing hire/book flow.
 * No booking commission, payment rails, matching, or calendar slots.
 */

export const hireAvailabilityFilterSchema = z.enum([
  'open',
  'limited',
  'unavailable',
  /** Open or limited — talent accepting briefs. */
  'hireable',
])
export type HireAvailabilityFilter = z.infer<typeof hireAvailabilityFilterSchema>

export const HIRE_AVAILABILITY_FILTER_LABEL: Record<HireAvailabilityFilter, string> = {
  open: 'Open',
  limited: 'Limited',
  unavailable: 'Unavailable',
  hireable: 'Open for hire',
}

export function hireAvailabilityWhere(
  filter?: HireAvailabilityFilter,
): { in: BookingAvailability[] } | BookingAvailability | undefined {
  if (!filter) return undefined
  if (filter === 'hireable') return { in: ['open', 'limited'] }
  return filter
}

export function isHireableAvailability(availability: BookingAvailability): boolean {
  return availability === 'open' || availability === 'limited'
}

export function formatDayRateUsd(rate: number | null | undefined): string | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null
  return `$${rate.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day`
}

export { bookingAvailabilitySchema }
