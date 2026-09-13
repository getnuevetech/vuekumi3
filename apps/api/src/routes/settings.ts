import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { listSettingsForAdmin, upsertSetting } from '../lib/settings.js'

const updateSchema = z.object({
  settings: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })),
})

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/admin/settings', {
    preHandler: requireAccountTypes(app, 'admin'),
  }, async () => {
    return { settings: await listSettingsForAdmin() }
  })

  app.put('/admin/settings', {
    preHandler: requireAccountTypes(app, 'admin'),
  }, async (request) => {
    const body = updateSchema.parse(request.body)
    for (const item of body.settings) {
      if (item.value.trim()) {
        await upsertSetting(item.key, item.value, request.userId)
      }
    }
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.update_settings',
      entityType: 'platform_settings',
      metadata: { keys: body.settings.filter((s) => s.value.trim()).map((s) => s.key) },
      ipAddress: request.ip,
    })
    return { settings: await listSettingsForAdmin() }
  })
}
