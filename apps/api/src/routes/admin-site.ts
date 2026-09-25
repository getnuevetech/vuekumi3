import type { FastifyInstance } from 'fastify'
import { siteContentSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { loadSitePublic, saveSiteContent } from '../lib/site-content.js'

export async function adminSiteRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAdminCapability(app, 'content.featured') }

  app.get('/admin/site', gate, async () => loadSitePublic())

  app.put('/admin/site', gate, async (request) => {
    const body = siteContentSchema.parse(request.body)
    const page = await saveSiteContent(body)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.site.content',
      entityType: 'site',
      entityId: 'public',
      metadata: { brand: page.content.brand.name, menu: page.content.menu.length },
      ipAddress: request.ip,
    })
    return page
  })
}
