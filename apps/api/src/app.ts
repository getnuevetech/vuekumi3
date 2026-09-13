import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './config.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { photoRoutes } from './routes/photos.js'
import { settingsRoutes } from './routes/settings.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

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
  }, { prefix: '/api' })

  return app
}
