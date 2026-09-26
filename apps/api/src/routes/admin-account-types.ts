import type { FastifyInstance } from 'fastify'
import { patchAccountTypesSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { loadAccountTypeConfigs, saveAccountTypeConfigs } from '../lib/account-features.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'

export async function adminAccountTypeRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAdminCapability(app, 'accounts.users.write') }

  app.get('/admin/account-types', gate, async () => ({ items: await loadAccountTypeConfigs() }))

  app.put('/admin/account-types', gate, async (request) => {
    const body = patchAccountTypesSchema.parse(request.body)
    const items = await saveAccountTypeConfigs(body.items)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.account_types',
      entityType: 'account_type',
      entityId: 'matrix',
      metadata: { types: items.map((item) => ({ accountType: item.accountType, enabled: item.enabled, features: item.features.length })) },
      ipAddress: request.ip,
    })
    return { items }
  })
}
