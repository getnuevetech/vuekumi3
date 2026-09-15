import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import { ZodError } from 'zod'
import { config } from './config.js'
import { registerRateLimit } from './lib/rate-limit.js'
import { captureException } from './lib/sentry.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { oauthRoutes } from './routes/oauth.js'
import { publicRoutes } from './routes/public.js'
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
import { paymentRoutes } from './routes/payments.js'
import { aiRoutes } from './routes/ai.js'
import { agencyRoutes } from './routes/agency.js'
import { payoutRoutes } from './routes/payouts.js'
import { photographerRoutes } from './routes/photographers.js'
import { collectionRoutes } from './routes/collections.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { adminMetricsRoutes } from './routes/admin-metrics.js'
import { reportRoutes } from './routes/reports.js'

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 55 * 1024 * 1024,
    trustProxy: true,
    routerOptions: { maxParamLength: 2048 },
  })

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })

  await app.register(cors, {
    origin: config.isDev ? true : [config.webUrl],
    credentials: true,
  })

  await app.register(cookie, { secret: config.cookieSecret })
  await app.register(jwt, { secret: config.jwtSecret })
  await registerRateLimit(app)

  app.setErrorHandler((err: unknown, request, reply) => {
    if (err instanceof ZodError) {
      const message = err.issues[0]?.message ?? 'Invalid request'
      return reply.code(400).send({ error: message })
    }
    const status =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 500
    if (status === 429) {
      return reply.code(429).send({ error: 'Too many requests' })
    }
    const message =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Request failed'
    if (status >= 500) {
      request.log.error(err)
      captureException(err)
      return reply.code(500).send({ error: config.isDev ? message : 'Internal server error' })
    }
    return reply.code(status).send({ error: message || 'Request failed' })
  })

  await app.register(async (api) => {
    await api.register(healthRoutes)
    await api.register(publicRoutes)
    await api.register(authRoutes)
    await api.register(oauthRoutes)
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
    await api.register(paymentRoutes)
    await api.register(aiRoutes)
    await api.register(agencyRoutes)
    await api.register(payoutRoutes)
    await api.register(photographerRoutes)
    await api.register(collectionRoutes)
    await api.register(subscriptionRoutes)
    await api.register(adminMetricsRoutes)
    await api.register(reportRoutes)
  }, { prefix: '/api' })

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: 'Not found' })
  })

  return app
}
