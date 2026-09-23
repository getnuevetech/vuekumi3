import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  acceptInviteSchema,
  personNameFrom,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '@vuekumi/shared'
import type { AgencyRole } from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import {
  AgencyError,
  canChangeRole,
  canManageTeam,
  canRemoveMember,
  inviteAccountBlocked,
  seatsRemaining,
} from '../lib/agency.js'
import { optionalAuthenticate, requireAgency } from '../lib/auth-middleware.js'
import { agencyInviteEmail, sendEmail } from '../lib/email.js'
import { createToken, hashPassword, hashToken } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { issueTokens } from '../lib/session.js'
import { authUserInclude, serializeGrant, serializeQuote, serializeUser } from '../lib/serialize.js'

const INVITE_DAYS = 14

function agencyError(reply: FastifyReply, err: unknown) {
  if (err instanceof AgencyError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

async function loadAgency(request: FastifyRequest, reply: FastifyReply) {
  const user = request.authUser
  if (!user?.agencyId || !user.agencyRole) {
    reply.code(403).send({ error: 'Agency workspace required' })
    return null
  }
  const agency = await prisma.agency.findUnique({ where: { id: user.agencyId } })
  if (!agency) {
    reply.code(403).send({ error: 'Agency workspace required' })
    return null
  }
  return { user, agency }
}

function serializeMember(row: {
  id: string
  userId: string
  agencyRole: AgencyRole
  status: string
  joinedAt: Date
  user: { name: string; email: string }
}) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    role: row.agencyRole,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
  }
}

function serializeInvite(row: {
  id: string
  email: string
  agencyRole: AgencyRole
  createdAt: Date
  expiresAt: Date
  acceptedAt: Date | null
}) {
  return {
    id: row.id,
    email: row.email,
    role: row.agencyRole,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
  }
}

async function seatSnapshot(agencyId: string, seatLimit: number, opts?: { excludeInviteId?: string }) {
  const now = new Date()
  const [memberCount, pendingInviteCount] = await Promise.all([
    prisma.agencyMember.count({ where: { agencyId, status: 'active' } }),
    prisma.agencyInvite.count({
      where: {
        agencyId,
        acceptedAt: null,
        expiresAt: { gt: now },
        ...(opts?.excludeInviteId ? { id: { not: opts.excludeInviteId } } : {}),
      },
    }),
  ])
  return {
    memberCount,
    pendingInviteCount,
    remaining: seatsRemaining({ seatLimit, memberCount, pendingInviteCount }),
  }
}

async function addMember(input: {
  agencyId: string
  userId: string
  role: Exclude<AgencyRole, 'owner'>
}) {
  const membership = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId } })
    if (!user) throw new AgencyError('Account not found', 404)
    const blocked = inviteAccountBlocked(user.accountType)
    if (blocked) throw new AgencyError(blocked, 403)

    const existing = await tx.agencyMember.findFirst({ where: { userId: input.userId } })
    if (existing) {
      if (existing.agencyId === input.agencyId) throw new AgencyError('Already a member of this agency')
      throw new AgencyError('This person already belongs to another agency', 409)
    }

    if (user.accountType === 'user') {
      await tx.user.update({ where: { id: user.id }, data: { accountType: 'agency' } })
    }

    return tx.agencyMember.create({
      data: {
        agencyId: input.agencyId,
        userId: input.userId,
        agencyRole: input.role,
        status: 'active',
      },
      include: { user: true },
    })
  })
  return membership
}

export async function agencyRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAgency(app) }

  app.get('/agency', gate, async (request, reply) => {
    const ctx = await loadAgency(request, reply)
    if (!ctx) return
    const { user, agency } = ctx
    const seats = await seatSnapshot(agency.id, agency.seatLimit)
    const [grantsCount, quotesCount, recentGrants, recentQuotes] = await Promise.all([
      prisma.licenseGrant.count({ where: { agencyId: agency.id } }),
      prisma.licenseQuote.count({ where: { agencyId: agency.id } }),
      prisma.licenseGrant.findMany({
        where: { agencyId: agency.id },
        include: { photo: true, product: true, buyer: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.licenseQuote.findMany({
        where: { agencyId: agency.id },
        include: { photo: true, requester: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    return {
      agency: {
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        plan: agency.plan,
        seatLimit: agency.seatLimit,
        seatsUsed: seats.memberCount,
        pendingInvites: seats.pendingInviteCount,
        billingEmail: agency.billingEmail,
        myRole: user.agencyRole,
        membersCount: seats.memberCount,
        grantsCount,
        quotesCount,
      },
      recentGrants: recentGrants.map(serializeGrant),
      recentQuotes: recentQuotes.map(serializeQuote),
    }
  })

  app.get('/agency/members', gate, async (request, reply) => {
    const ctx = await loadAgency(request, reply)
    if (!ctx) return
    const members = await prisma.agencyMember.findMany({
      where: { agencyId: ctx.agency.id },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    })
    const invites = await prisma.agencyInvite.findMany({
      where: { agencyId: ctx.agency.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    return {
      items: members.map(serializeMember),
      invites: invites.map(serializeInvite),
      seatLimit: ctx.agency.seatLimit,
      seatsUsed: members.filter((m) => m.status === 'active').length,
    }
  })

  app.post('/agency/members', gate, async (request, reply) => {
    const ctx = await loadAgency(request, reply)
    if (!ctx) return
    if (!canManageTeam(ctx.user.agencyRole!)) {
      return reply.code(403).send({ error: 'Only owners and admins can invite teammates' })
    }

    try {
      const body = inviteMemberSchema.parse(request.body)
      const assignedRole = body.role ?? 'member'
      if (ctx.user.agencyRole === 'admin' && assignedRole === 'admin') {
        return reply.code(403).send({ error: 'Only the owner can invite admins' })
      }
      const email = body.email.toLowerCase()
      const seats = await seatSnapshot(ctx.agency.id, ctx.agency.seatLimit)

      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        if (seats.remaining <= 0) {
          throw new AgencyError(`Seat limit of ${ctx.agency.seatLimit} reached`)
        }
        const member = await addMember({
          agencyId: ctx.agency.id,
          userId: existingUser.id,
          role: assignedRole,
        })
        await prisma.agencyInvite.updateMany({
          where: { agencyId: ctx.agency.id, email, acceptedAt: null },
          data: { acceptedAt: new Date() },
        })
        await writeAuditLog({
          actorId: request.userId,
          action: 'agency.member_add',
          entityType: 'agency',
          entityId: ctx.agency.id,
          metadata: { email, role: assignedRole, immediate: true },
          ipAddress: request.ip,
        })
        await sendEmail({
          to: email,
          subject: `You were added to ${ctx.agency.name} on Vuekumi`,
          html: `<p>Hi ${member.user.name},</p><p>You now have a ${assignedRole} seat on <strong>${ctx.agency.name}</strong>. Sign in to open the agency portal.</p><p><a href="${config.webUrl}/agency">${config.webUrl}/agency</a></p>`,
        })
        return { member: serializeMember(member), immediate: true }
      }

      if (seats.remaining <= 0) {
        throw new AgencyError(`Seat limit of ${ctx.agency.seatLimit} reached`)
      }

      const pending = await prisma.agencyInvite.findFirst({
        where: { agencyId: ctx.agency.id, email, acceptedAt: null, expiresAt: { gt: new Date() } },
      })
      if (pending) {
        throw new AgencyError('An invite is already pending for this email')
      }

      const raw = createToken()
      const invite = await prisma.agencyInvite.create({
        data: {
          agencyId: ctx.agency.id,
          email,
          agencyRole: assignedRole,
          tokenHash: hashToken(raw),
          invitedById: ctx.user.id,
          expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
        },
      })
      const joinUrl = `${config.webUrl}/join/${raw}`
      await sendEmail({
        to: email,
        subject: `Join ${ctx.agency.name} on Vuekumi`,
        html: agencyInviteEmail(ctx.agency.name, assignedRole, joinUrl),
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'agency.invite',
        entityType: 'agency',
        entityId: ctx.agency.id,
        metadata: { email, role: assignedRole },
        ipAddress: request.ip,
      })
      return { invite: serializeInvite(invite), joinUrl, immediate: false }
    } catch (err) {
      return agencyError(reply, err)
    }
  })

  app.patch('/agency/members/:userId', gate, async (request, reply) => {
    const ctx = await loadAgency(request, reply)
    if (!ctx) return
    const { userId } = request.params as { userId: string }
    const body = updateMemberRoleSchema.parse(request.body)
    const target = await prisma.agencyMember.findUnique({
      where: { agencyId_userId: { agencyId: ctx.agency.id, userId } },
      include: { user: true },
    })
    if (!target) return reply.code(404).send({ error: 'Member not found' })
    if (!canChangeRole(ctx.user.agencyRole!, target.agencyRole, body.role)) {
      return reply.code(403).send({ error: 'You cannot change this role' })
    }
    const updated = await prisma.agencyMember.update({
      where: { id: target.id },
      data: { agencyRole: body.role },
      include: { user: true },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'agency.member_role',
      entityType: 'agency_member',
      entityId: target.id,
      metadata: { userId, role: body.role },
      ipAddress: request.ip,
    })
    return { member: serializeMember(updated) }
  })

  app.delete('/agency/members/:userId', gate, async (request, reply) => {
    const ctx = await loadAgency(request, reply)
    if (!ctx) return
    const { userId } = request.params as { userId: string }
    const target = await prisma.agencyMember.findUnique({
      where: { agencyId_userId: { agencyId: ctx.agency.id, userId } },
    })
    if (!target) return reply.code(404).send({ error: 'Member not found' })
    const isSelf = userId === ctx.user.id
    if (!canRemoveMember(ctx.user.agencyRole!, target.agencyRole, isSelf)) {
      return reply.code(403).send({ error: 'You cannot remove this member' })
    }
    await prisma.agencyMember.delete({ where: { id: target.id } })
    await writeAuditLog({
      actorId: request.userId,
      action: 'agency.member_remove',
      entityType: 'agency',
      entityId: ctx.agency.id,
      metadata: { userId },
      ipAddress: request.ip,
    })
    return { ok: true }
  })

  app.delete('/agency/invites/:id', gate, async (request, reply) => {
    const ctx = await loadAgency(request, reply)
    if (!ctx) return
    if (!canManageTeam(ctx.user.agencyRole!)) {
      return reply.code(403).send({ error: 'Only owners and admins can revoke invites' })
    }
    const { id } = request.params as { id: string }
    const invite = await prisma.agencyInvite.findUnique({ where: { id } })
    if (!invite || invite.agencyId !== ctx.agency.id) {
      return reply.code(404).send({ error: 'Invite not found' })
    }
    await prisma.agencyInvite.delete({ where: { id } })
    return { ok: true }
  })

  app.get('/agency/join/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const invite = await prisma.agencyInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { agency: true },
    })
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return reply.code(404).send({ error: 'Invite is invalid or has expired' })
    }
    const existing = await prisma.user.findUnique({ where: { email: invite.email } })
    return {
      invite: {
        agencyName: invite.agency.name,
        email: invite.email,
        role: invite.agencyRole,
        expiresAt: invite.expiresAt.toISOString(),
        needsAccount: !existing,
      },
    }
  })

  app.post('/agency/join/:token', async (request, reply) => {
    try {
      const { token } = request.params as { token: string }
      const body = acceptInviteSchema.parse(request.body ?? {})
      const invite = await prisma.agencyInvite.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { agency: true },
      })
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new AgencyError('Invite is invalid or has expired', 404)
      }

      await optionalAuthenticate(app, request, reply)

      let user = await prisma.user.findUnique({ where: { email: invite.email } })
      if (user) {
        if (!request.authUser || request.authUser.email.toLowerCase() !== invite.email) {
          return reply.code(401).send({ error: 'Sign in with the invited email to join this agency' })
        }
      } else {
        if (!body.password) {
          throw new AgencyError('A password is required to create your account')
        }
        const person = personNameFrom(body)
        user = await prisma.user.create({
          data: {
            email: invite.email,
            passwordHash: await hashPassword(body.password),
            name: person.name,
            firstName: person.firstName,
            lastName: person.lastName,
            accountType: 'agency',
            country: body.country?.toUpperCase(),
            status: 'active',
            emailVerifiedAt: new Date(),
          },
        })
      }

      const seats = await seatSnapshot(invite.agencyId, invite.agency.seatLimit, { excludeInviteId: invite.id })
      if (seats.remaining <= 0) {
        throw new AgencyError(`Seat limit of ${invite.agency.seatLimit} reached`)
      }

      const member = await addMember({
        agencyId: invite.agencyId,
        userId: user.id,
        role: invite.agencyRole === 'owner' ? 'member' : invite.agencyRole,
      })
      await prisma.agencyInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      })
      await issueTokens(app, user.id, reply, request)
      const full = await prisma.user.findUnique({
        where: { id: user.id },
        include: authUserInclude,
      })
      await writeAuditLog({
        actorId: user.id,
        action: 'agency.invite_accept',
        entityType: 'agency',
        entityId: invite.agencyId,
        metadata: { role: member.agencyRole },
        ipAddress: request.ip,
      })
      return { user: serializeUser(full!), member: serializeMember(member) }
    } catch (err) {
      return agencyError(reply, err)
    }
  })
}
