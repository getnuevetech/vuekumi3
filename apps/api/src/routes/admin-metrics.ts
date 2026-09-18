import type { FastifyInstance } from 'fastify'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { loadAdminOverview } from '../lib/admin-metrics.js'

export async function adminMetricsRoutes(app: FastifyInstance) {
  const admin = { preHandler: requireAdminCapability(app, 'metrics.view') }

  app.get('/admin/metrics/overview', admin, async () => loadAdminOverview())
}
