import type { FastifyInstance } from 'fastify'
import { requireCreatorWorkspace } from '../lib/auth-middleware.js'
import { registerContributorStatsRoutes } from './contributor/stats.js'
import { registerContributorUploadRoutes } from './contributor/uploads.js'
import { registerContributorPhotoRoutes } from './contributor/photos.js'
import { registerContributorReleaseRoutes } from './contributor/releases.js'
import { registerContributorAppearanceRoutes } from './contributor/appearances.js'
import { registerContributorRightsRoutes } from './contributor/rights.js'

export async function contributorRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireCreatorWorkspace(app) }
  await registerContributorStatsRoutes(app, gate)
  await registerContributorUploadRoutes(app, gate)
  await registerContributorPhotoRoutes(app, gate)
  await registerContributorReleaseRoutes(app, gate)
  await registerContributorAppearanceRoutes(app, gate)
  await registerContributorRightsRoutes(app, gate)
}
