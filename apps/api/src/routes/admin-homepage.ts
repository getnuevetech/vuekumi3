import type { FastifyInstance } from 'fastify'
import { patchHomeFeaturedSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { loadHomeFeaturedAdmin, replaceHomePins } from '../lib/home-featured.js'

export async function adminHomepageRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAdminCapability(app, 'content.featured') }

  app.get('/admin/homepage', gate, async () => loadHomeFeaturedAdmin())

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
