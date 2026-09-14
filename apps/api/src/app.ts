import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './config.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { photoRoutes } from './routes/photos.js'
import { settingsRoutes } from './routes/settings.js'
import { geoRoutes } from './routes/geo.js'
import { adminGeoRoutes } from './routes/admin-geo.js'
import { adminAccountRoutes } from './routes/admin-accounts.js'
import { adminIntegrationRoutes } from './routes/admin-integrations.js'
import { licenseRoutes } from './routes/licenses.js'
import { contributorRoutes } from './routes/contributor.js'
import { adminContentRoutes } from './routes/admin-content.js'
import { mediaRoutes } from './routes/media.js'

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 55 * 1024 * 1024, maxParamLength: 2048 })

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await app.register(cookie, { secret: config.cookieSecret })
  await app.register(jwt, { secret: config.jwtSecret })

  await app.register(async (api) => {
    await api.register(healthRoutes)
    await api.register(authRoutes)
    await api.register(photoRoutes)
    await api.register(settingsRoutes)
    await api.register(geoRoutes)
    await api.register(adminGeoRoutes)
    await api.register(adminAccountRoutes)
    await api.register(adminIntegrationRoutes)
    await api.register(licenseRoutes)
    await api.register(contributorRoutes)
    await api.register(adminContentRoutes)
    await api.register(mediaRoutes)
  }, { prefix: '/api' })

  return app
}
