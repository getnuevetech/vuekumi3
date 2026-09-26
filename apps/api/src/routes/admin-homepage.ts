import type { FastifyInstance } from 'fastify'
import { patchHomeFeaturedSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { loadHomeFeaturedAdmin, replaceHomePins } from '../lib/home-featured.js'
import { prisma } from '../lib/prisma.js'

export async function adminHomepageRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAdminCapability(app, 'content.featured') }

  app.get('/admin/homepage', gate, async () => loadHomeFeaturedAdmin())

  app.get('/admin/homepage/contributors', gate, async (request) => {
    const query = request.query as { q?: string }
    const q = query.q?.trim() ?? ''
    const users = await prisma.user.findMany({
      where: {
        status: 'active',
        contributorProfile: { isNot: null },
        accountType: { in: ['photographer', 'photo_influencer', 'contributor'] },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { contributorProfile: { handle: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        accountType: true,
        contributorProfile: { select: { handle: true, location: true } },
      },
      orderBy: { name: 'asc' },
      take: 20,
    })
    return {
      items: users.flatMap((user) => user.contributorProfile ? [{
        id: user.id,
        name: user.name,
        handle: user.contributorProfile.handle,
        avatarUrl: user.avatarUrl,
        location: user.contributorProfile.location,
        accountType: user.accountType,
      }] : []),
    }
  })

  app.put('/admin/homepage', gate, async (request) => {
    const body = patchHomeFeaturedSchema.parse(request.body)
    const page = await replaceHomePins(body)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.homepage.featured',
      entityType: 'homepage',
      entityId: 'featured',
      metadata: { pins: body.pins },
      ipAddress: request.ip,
    })
    return page
  })
}
