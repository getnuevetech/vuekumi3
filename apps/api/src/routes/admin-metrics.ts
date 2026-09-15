import type { FastifyInstance } from 'fastify'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { loadAdminOverview } from '../lib/admin-metrics.js'

export async function adminMetricsRoutes(app: FastifyInstance) {
  const admin = { preHandler: requireAccountTypes(app, 'admin') }

  app.get('/admin/metrics/overview', admin, async () => loadAdminOverview())
}
