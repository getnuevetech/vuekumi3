import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'

const listQuery = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

const patchUser = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  country: z.string().optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
})

function serializeAccount(user: {
  id: string
  email: string
  name: string
  accountType: string
  status: string
  country: string | null
  createdAt: Date
  emailVerifiedAt: Date | null
  contributorProfile: { handle: string; photosCount: number; earnings: number; downloads: number } | null
  modelProfile: { handle: string } | null
  userProfile: { subscriptionPlan: string; downloadQuotaUsed: number } | null
  adminProfile: { adminRole: string } | null
  ownedAgencies: { id: string; name: string; status: string }[]
  _count?: { modelAppearances: number }
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountType: user.accountType,
    status: user.status,
    country: user.country,
    joined: user.createdAt.toISOString().slice(0, 10),
    emailVerified: Boolean(user.emailVerifiedAt),
    handle: user.contributorProfile?.handle ?? user.modelProfile?.handle ?? null,
    photos: user.contributorProfile?.photosCount ?? 0,
    earnings: user.contributorProfile?.earnings ?? 0,
    downloads: user.contributorProfile?.downloads ?? user.userProfile?.downloadQuotaUsed ?? 0,
    plan: user.userProfile?.subscriptionPlan ?? null,
    adminRole: user.adminProfile?.adminRole ?? null,
    agencyName: user.ownedAgencies[0]?.name ?? null,
    agencyStatus: user.ownedAgencies[0]?.status ?? null,
    appearances: user._count?.modelAppearances ?? 0,
    dualRole: Boolean(user.contributorProfile && user.modelProfile),
  }
}

const include = {
  contributorProfile: true,
  modelProfile: true,
  userProfile: true,
  adminProfile: true,
  ownedAgencies: true,
  _count: { select: { modelAppearances: true } },
} as const

export async function adminAccountRoutes(app: FastifyInstance) {
  const admin = { preHandler: requireAccountTypes(app, 'admin') }

  async function list(accountType: 'user' | 'contributor' | 'agency' | 'admin' | 'model', request: { query: unknown }) {
    const query = listQuery.parse(request.query)
    const where = {
      accountType,
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
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])
    return { items: users.map(serializeAccount), total, page: query.page, limit: query.limit }
  }

  app.get('/admin/users', admin, async (request) => list('user', request))
  app.get('/admin/contributors', admin, async (request) => list('contributor', request))
  app.get('/admin/agencies', admin, async (request) => list('agency', request))
  app.get('/admin/admins', admin, async (request) => list('admin', request))
  app.get('/admin/models', admin, async (request) => {
    const query = listQuery.parse(request.query)
    const where = {
      modelProfile: { isNot: null },
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
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])
    return { items: users.map(serializeAccount), total, page: query.page, limit: query.limit }
  })

  app.get('/admin/accounts/:id', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = await prisma.user.findUnique({ where: { id }, include })
    if (!user) return reply.code(404).send({ error: 'Account not found' })
    return { user: serializeAccount(user) }
  })

  app.patch('/admin/accounts/:id', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = patchUser.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'Account not found' })
    const user = await prisma.user.update({
      where: { id },
      data: body,
      include,
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.update_account',
      entityType: 'user',
      entityId: id,
      metadata: body,
    })
    return { user: serializeAccount(user) }
  })
}
