import type { FastifyInstance } from 'fastify'
import { config } from '../config.js'
import { googleOAuthConfigured } from '../lib/oauth.js'
import { getSettingSafe } from '../lib/settings.js'

export async function publicRoutes(app: FastifyInstance) {
  app.get('/public/config', async () => {
    const google = await googleOAuthConfigured()
    const sentryDsn = (await getSettingSafe('ops.sentry_dsn')) ?? null
    return {
      oauth: {
        google,
        dev: config.isDev && !google,
      },
      sentryDsn: sentryDsn && sentryDsn.startsWith('http') ? sentryDsn : null,
    }
  })
}
