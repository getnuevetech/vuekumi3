import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  bookingActionBlocked,
  bookingCreateBlocked,
  bookingQuoteSchema,
  createBookingSchema,
} from '@vuekumi/shared'
import type { BookingDto } from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate } from '../lib/auth-middleware.js'
import {
  bookingDecisionEmail,
  bookingQuotedEmail,
  bookingRequestEmail,
  sendEmail,
} from '../lib/email.js'
import { prisma } from '../lib/prisma.js'

const bookingInclude = {
  target: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      contributorProfile: { select: { handle: true } },
      modelProfile: { select: { handle: true } },
    },
  },
  requester: { select: { id: true, name: true, email: true } },
} as const

type BookingWithParties = {
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
  targetId: string
  requesterId: string
  target: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    contributorProfile: { handle: string } | null
    modelProfile: { handle: string } | null
  }
  requester: { id: string; name: string; email: string }
}

function serializeBooking(booking: BookingWithParties, viewerId: string): BookingDto {
  const handle =
    booking.kind === 'photographer'
      ? booking.target.contributorProfile?.handle
      : booking.target.modelProfile?.handle
  return {
    id: booking.id,
    kind: booking.kind,
    status: booking.status,
    role: booking.requesterId === viewerId ? 'sent' : 'received',
    title: booking.title,
    brief: booking.brief,
    location: booking.location,
    startDate: booking.startDate ? booking.startDate.toISOString().slice(0, 10) : null,
    endDate: booking.endDate ? booking.endDate.toISOString().slice(0, 10) : null,
    budgetUsd: booking.budgetUsd,
    quoteUsd: booking.quoteUsd,
    quoteNote: booking.quoteNote,
    requesterName: booking.requester.name,
    targetName: booking.target.name,
    targetHandle: handle ?? '',
    targetAvatarUrl: booking.target.avatarUrl,
    createdAt: booking.createdAt.toISOString(),
    respondedAt: booking.respondedAt ? booking.respondedAt.toISOString() : null,
  }
}

async function loadBooking(id: string) {
  return prisma.bookingRequest.findUnique({ where: { id }, include: bookingInclude })
}

const BOOKINGS_URL = () => `${config.webUrl}/bookings`

export async function bookingRoutes(app: FastifyInstance) {
  const auth = {
    preHandler: (request: FastifyRequest, reply: FastifyReply) => authenticate(app, request, reply),
  }

  app.post('/bookings', auth, async (request, reply) => {
    const body = createBookingSchema.parse(request.body)

    const target =
      body.kind === 'photographer'
        ? await prisma.user.findFirst({
            where: {
              accountType: 'photographer',
              contributorProfile: { handle: { equals: body.handle, mode: 'insensitive' } },
            },
            include: { contributorProfile: true, modelProfile: true },
          })
        : await prisma.user.findFirst({
            where: { modelProfile: { handle: { equals: body.handle, mode: 'insensitive' } } },
            include: { contributorProfile: true, modelProfile: true },
          })

    const availability =
      body.kind === 'photographer'
        ? target?.contributorProfile?.availability
        : target?.modelProfile?.availability

    const blocked = bookingCreateBlocked({
      targetFound: Boolean(target),
      targetActive: target?.status === 'active',
      availability: availability ?? 'open',
      isSelf: target?.id === request.userId,
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const booking = await prisma.bookingRequest.create({
      data: {
        kind: body.kind,
        targetId: target!.id,
        requesterId: request.userId!,
        title: body.title.trim(),
        brief: body.brief.trim(),
        location: body.location?.trim() || null,
        startDate: body.startDate ? new Date(`${body.startDate}T00:00:00.000Z`) : null,
        endDate: body.endDate ? new Date(`${body.endDate}T00:00:00.000Z`) : null,
        budgetUsd: body.budgetUsd ?? null,
      },
      include: bookingInclude,
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'booking.request',
      entityType: 'booking',
      entityId: booking.id,
      metadata: { kind: body.kind, targetId: target!.id },
      ipAddress: request.ip,
    })

    await sendEmail({
      to: booking.target.email,
      subject: `Booking request: ${booking.title}`,
      html: bookingRequestEmail({
        name: booking.target.name,
        requesterName: booking.requester.name,
        title: booking.title,
        bookingsUrl: BOOKINGS_URL(),
      }),
    })

    return { booking: serializeBooking(booking, request.userId!) }
  })

  app.get('/bookings', auth, async (request) => {
    const bookings = await prisma.bookingRequest.findMany({
      where: { OR: [{ requesterId: request.userId! }, { targetId: request.userId! }] },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    })
    return { items: bookings.map((b) => serializeBooking(b, request.userId!)) }
  })

  app.post('/bookings/:id/quote', auth, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = bookingQuoteSchema.parse(request.body)
    const booking = await loadBooking(id)
    if (!booking) return reply.code(404).send({ error: 'Booking not found' })

    const blocked = bookingActionBlocked({
      action: 'quote',
      status: booking.status,
      isTarget: booking.targetId === request.userId,
      isRequester: booking.requesterId === request.userId,
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const updated = await prisma.bookingRequest.update({
      where: { id },
      data: {
        status: 'quoted',
        quoteUsd: body.quoteUsd,
        quoteNote: body.note?.trim() || null,
        respondedAt: new Date(),
      },
      include: bookingInclude,
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'booking.quote',
      entityType: 'booking',
      entityId: id,
      metadata: { quoteUsd: body.quoteUsd },
      ipAddress: request.ip,
    })

    await sendEmail({
      to: updated.requester.email,
      subject: `Quote received: ${updated.title}`,
      html: bookingQuotedEmail({
        name: updated.requester.name,
        targetName: updated.target.name,
        title: updated.title,
        quoteUsd: body.quoteUsd,
        bookingsUrl: BOOKINGS_URL(),
      }),
    })

    return { booking: serializeBooking(updated, request.userId!) }
  })

  async function decide(
    request: FastifyRequest,
    reply: FastifyReply,
    id: string,
    action: 'accept' | 'decline' | 'withdraw',
  ) {
    const booking = await loadBooking(id)
    if (!booking) return reply.code(404).send({ error: 'Booking not found' })

    const blocked = bookingActionBlocked({
      action,
      status: booking.status,
      isTarget: booking.targetId === request.userId,
      isRequester: booking.requesterId === request.userId,
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'withdrawn'
    const updated = await prisma.bookingRequest.update({
      where: { id },
      data: { status, respondedAt: new Date() },
      include: bookingInclude,
    })

    await writeAuditLog({
      actorId: request.userId,
      action: `booking.${action}`,
      entityType: 'booking',
      entityId: id,
      ipAddress: request.ip,
    })

    // Notify the other party. Accept/withdraw come from the requester; decline
    // comes from the creator.
    const notifyTarget = action !== 'decline'
    await sendEmail({
      to: notifyTarget ? updated.target.email : updated.requester.email,
      subject: `Booking ${status}: ${updated.title}`,
      html: bookingDecisionEmail({
        name: notifyTarget ? updated.target.name : updated.requester.name,
        otherName: notifyTarget ? updated.requester.name : updated.target.name,
        title: updated.title,
        decision: status,
        bookingsUrl: BOOKINGS_URL(),
      }),
    })

    return { booking: serializeBooking(updated, request.userId!) }
  }

  app.post('/bookings/:id/accept', auth, async (request, reply) =>
    decide(request, reply, (request.params as { id: string }).id, 'accept'))

  app.post('/bookings/:id/decline', auth, async (request, reply) =>
    decide(request, reply, (request.params as { id: string }).id, 'decline'))

  app.post('/bookings/:id/withdraw', auth, async (request, reply) =>
    decide(request, reply, (request.params as { id: string }).id, 'withdraw'))
}
