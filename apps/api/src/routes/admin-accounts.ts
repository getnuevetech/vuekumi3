import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import {
  accountListCapability,
  accountWriteCapability,
  adminAgencyStatusSchema,
  adminCreateAccountBlocked,
  adminCreateAccountSchema,
  adminCreateAdminSchema,
  adminHas,
  adminPatchAccountSchema,
  adminPatchAdminSchema,
  lastSuperAdminBlocked,
  selfCapabilityEditBlocked,
  storedAdminCapabilities,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import {
  adminAccountInclude,
  isLastActiveSuperAdmin,
  provisionStaffCreatedAdmin,
  provisionStaffCreatedUser,
  serializeAdminAccount,
} from '../lib/admin-accounts.js'
import { requireAdminCapability, requireAccountTypes } from '../lib/auth-middleware.js'
import { assertContributorCountry } from '../lib/geo.js'
import { prisma } from '../lib/prisma.js'
import { z } from 'zod'

const listQuery = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

function searchWhere(query: z.infer<typeof listQuery>) {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { email: { contains: query.q, mode: 'insensitive' as const } },
            { country: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
}

export async function adminAccountRoutes(app: FastifyInstance) {
  const staff = { preHandler: requireAccountTypes(app, 'admin') }
  const cap = (key: Parameters<typeof requireAdminCapability>[1]) => ({
    preHandler: requireAdminCapability(app, key),
  })

  async function list(where: Prisma.UserWhereInput, request: { query: unknown }) {
    const query = listQuery.parse(request.query)
    const fullWhere = { ...where, ...searchWhere(query) }
    const [total, users] = await Promise.all([
      prisma.user.count({ where: fullWhere }),
      prisma.user.findMany({
        where: fullWhere,
        include: adminAccountInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])
    return { items: users.map(serializeAdminAccount), total, page: query.page, limit: query.limit }
  }

  app.get('/admin/users', cap(accountListCapability('users')), async (request) =>
    list({ accountType: 'user' }, request),
  )
  app.get('/admin/contributors', cap(accountListCapability('contributors')), async (request) =>
    list({ accountType: 'contributor' }, request),
  )
  app.get('/admin/photographers', cap(accountListCapability('photographers')), async (request) =>
    list({ accountType: 'photographer' }, request),
  )
  app.get('/admin/agencies', cap(accountListCapability('agencies')), async (request) =>
    list({ accountType: 'agency' }, request),
  )
  app.get('/admin/admins', cap(accountListCapability('admins')), async (request) =>
    list({ accountType: 'admin' }, request),
  )
  app.get('/admin/models', cap(accountListCapability('models')), async (request) =>
    list({ modelProfile: { isNot: null } }, request),
  )

  app.get('/admin/accounts/:id', cap('accounts.read'), async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = await prisma.user.findUnique({ where: { id }, include: adminAccountInclude })
    if (!user) return reply.code(404).send({ error: 'Account not found' })
    return { user: serializeAdminAccount(user) }
  })

  app.post('/admin/accounts', staff, async (request, reply) => {
    const body = adminCreateAccountSchema.parse(request.body)
    const blocked = adminCreateAccountBlocked(body.accountType)
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })
    if (!adminHas(request.authUser, accountWriteCapability(body.accountType))) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) return reply.code(409).send({ error: 'Email already registered' })

    if (body.accountType === 'photographer' || body.accountType === 'contributor') {
      try {
        await assertContributorCountry(body.country)
      } catch (err) {
        const e = err as Error & { statusCode?: number }
        return reply.code(e.statusCode ?? 400).send({ error: e.message })
      }
    }

    const id = await provisionStaffCreatedUser(body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: adminAccountInclude })

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.create_account',
      entityType: 'user',
      entityId: id,
      metadata: { accountType: body.accountType, email: user.email },
      ipAddress: request.ip,
    })

    return { user: serializeAdminAccount(user) }
  })

  app.post('/admin/admins', cap('accounts.admins.manage'), async (request, reply) => {
    const body = adminCreateAdminSchema.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) return reply.code(409).send({ error: 'Email already registered' })

    const stored = storedAdminCapabilities(body.preset, body.capabilities)
    const id = await provisionStaffCreatedAdmin(body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: adminAccountInclude })

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.create_admin',
      entityType: 'user',
      entityId: id,
      metadata: {
        email: user.email,
        preset: body.preset,
        customized: stored.capabilitiesCustomized,
      },
      ipAddress: request.ip,
    })

    return { user: serializeAdminAccount(user) }
  })

  app.patch('/admin/admins/:id', cap('accounts.admins.manage'), async (request, reply) => {
    const { id } = request.params as { id: string }
    const selfBlocked = selfCapabilityEditBlocked(request.userId!, id)
    if (selfBlocked) return reply.code(selfBlocked.status).send({ error: selfBlocked.error })

    const body = adminPatchAdminSchema.parse(request.body)
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { adminProfile: true },
    })
    if (!existing || existing.accountType !== 'admin' || !existing.adminProfile) {
      return reply.code(404).send({ error: 'Admin not found' })
    }

    const nextRole = body.preset ?? existing.adminProfile.adminRole
    const stored = body.capabilities !== undefined
      ? storedAdminCapabilities(nextRole, body.capabilities)
      : body.preset
        ? storedAdminCapabilities(body.preset)
        : storedAdminCapabilities(
            existing.adminProfile.adminRole,
            existing.adminProfile.capabilitiesCustomized
              ? existing.adminProfile.capabilities
              : undefined,
          )

    const lastBlocked = lastSuperAdminBlocked({
      isLastSuperAdmin: await isLastActiveSuperAdmin(id),
      nextRole,
      nextCustomized: stored.capabilitiesCustomized,
      nextCapabilities: stored.capabilities,
    })
    if (lastBlocked) return reply.code(lastBlocked.status).send({ error: lastBlocked.error })

    await prisma.adminProfile.update({
      where: { userId: id },
      data: {
        adminRole: nextRole,
        capabilities: stored.capabilities,
        capabilitiesCustomized: stored.capabilitiesCustomized,
      },
    })
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: adminAccountInclude })
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.update_admin_capabilities',
      entityType: 'user',
      entityId: id,
      metadata: {
        preset: nextRole,
        customized: stored.capabilitiesCustomized,
        capabilities: stored.capabilities,
      },
      ipAddress: request.ip,
    })
    return { user: serializeAdminAccount(user) }
  })

  app.patch('/admin/accounts/:id', staff, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = adminPatchAccountSchema.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'Account not found' })
    if (!adminHas(request.authUser, accountWriteCapability(existing.accountType))) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (existing.accountType === 'admin' && body.status) {
      const lastBlocked = lastSuperAdminBlocked({
        isLastSuperAdmin: await isLastActiveSuperAdmin(id),
        nextStatus: body.status,
      })
      if (lastBlocked) return reply.code(lastBlocked.status).send({ error: lastBlocked.error })
    }

    if (body.email && body.email.toLowerCase() !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
      if (taken) return reply.code(409).send({ error: 'Email already registered' })
    }

    let country = body.country
    if (country !== undefined) {
      country = country ? country.toUpperCase() : ''
      if (
        country
        && (existing.accountType === 'photographer' || existing.accountType === 'contributor')
      ) {
        try {
          await assertContributorCountry(country)
        } catch (err) {
          const e = err as Error & { statusCode?: number }
          return reply.code(e.statusCode ?? 400).send({ error: e.message })
        }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.email ? { email: body.email.toLowerCase() } : {}),
        ...(country !== undefined ? { country: country || null } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      include: adminAccountInclude,
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.update_account',
      entityType: 'user',
      entityId: id,
      metadata: body,
      ipAddress: request.ip,
    })
    return { user: serializeAdminAccount(user) }
  })

  app.post('/admin/agencies/:id/status', cap('accounts.agencies.activate'), async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = adminAgencyStatusSchema.parse(request.body)
    const agency = await prisma.agency.findUnique({ where: { id } })
    if (!agency) return reply.code(404).send({ error: 'Agency not found' })

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.agency.update({
        where: { id },
        data: { status: body.status },
      })
      if (body.status === 'active') {
        await tx.user.updateMany({
          where: { id: agency.ownerUserId, status: 'pending' },
          data: { status: 'active' },
        })
      }
      return next
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.agency_status',
      entityType: 'agency',
      entityId: id,
      metadata: { from: agency.status, to: body.status },
      ipAddress: request.ip,
    })

    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: agency.ownerUserId },
      include: adminAccountInclude,
    })
    return { agency: { id: updated.id, name: updated.name, status: updated.status }, user: serializeAdminAccount(owner) }
  })
}
