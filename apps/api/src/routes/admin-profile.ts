import type { FastifyInstance } from 'fastify'
import { patchProfileRequirementsSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { loadProfileRequirements, saveProfileRequirements } from '../lib/profile-requirements.js'

export async function adminProfileRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAdminCapability(app, 'accounts.users.list') }

  app.get('/admin/profile-fields', gate, async () => loadProfileRequirements())

  app.put('/admin/profile-fields', gate, async (request) => {
    const body = patchProfileRequirementsSchema.parse(request.body)
    const page = await saveProfileRequirements(body.items)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.profile.requirements',
      entityType: 'profile_requirement',
      entityId: 'public',
      metadata: { accounts: body.items.length },
      ipAddress: request.ip,
    })
    return page
  })
}
