import type { FastifyInstance } from 'fastify'
import type { BookingAdminDto } from '@vuekumi/shared'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'

const bookingInclude = {
  target: {
    select: {
      name: true,
      email: true,
      avatarUrl: true,
      contributorProfile: { select: { handle: true } },
      modelProfile: { select: { handle: true } },
    },
  },
  requester: { select: { name: true, email: true } },
} as const

function serializeAdminBooking(booking: {
  id: string
  kind: 'photographer' | 'model'
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'withdrawn'
  title: string
  brief: string
  location: string | null
  startDate: Date | null
  endDate: Date | null
  budgetUsd: number | null
  quoteUsd: number | null
  quoteNote: string | null
  createdAt: Date
  respondedAt: Date | null
  target: {
    name: string
    email: string
    avatarUrl: string | null
    contributorProfile: { handle: string } | null
    modelProfile: { handle: string } | null
  }
  requester: { name: string; email: string }
}): BookingAdminDto {
  const handle =
    booking.kind === 'photographer'
      ? booking.target.contributorProfile?.handle
      : booking.target.modelProfile?.handle
  return {
    id: booking.id,
    kind: booking.kind,
    status: booking.status,
    title: booking.title,
    brief: booking.brief,
    location: booking.location,
    startDate: booking.startDate ? booking.startDate.toISOString().slice(0, 10) : null,
    endDate: booking.endDate ? booking.endDate.toISOString().slice(0, 10) : null,
    budgetUsd: booking.budgetUsd,
    quoteUsd: booking.quoteUsd,
    quoteNote: booking.quoteNote,
    requesterName: booking.requester.name,
    requesterEmail: booking.requester.email,
    targetName: booking.target.name,
    targetEmail: booking.target.email,
    targetHandle: handle ?? '',
    targetAvatarUrl: booking.target.avatarUrl,
    createdAt: booking.createdAt.toISOString(),
    respondedAt: booking.respondedAt ? booking.respondedAt.toISOString() : null,
  }
}

/**
 * Phase 42 — staff booking queue. Read-only visibility. Parties still quote /
 * accept / decline / withdraw. No booking commission and no payment rails.
 */
export async function adminBookingRoutes(app: FastifyInstance) {
  const list = { preHandler: requireAdminCapability(app, 'bookings.list') }

  app.get('/admin/bookings', list, async () => {
    const bookings = await prisma.bookingRequest.findMany({
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return { items: bookings.map(serializeAdminBooking) }
  })
}
