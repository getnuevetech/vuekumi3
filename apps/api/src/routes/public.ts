import type { FastifyInstance } from 'fastify'
import { config } from '../config.js'
import { googleOAuthConfigured } from '../lib/oauth.js'
import { getSettingSafe } from '../lib/settings.js'
import { getContributorShare } from '../lib/payments-config.js'
import { listBuyerPlans, serializeBuyerPlan } from '../lib/buyer-plans.js'
import { loadHomePage } from '../lib/home-queries.js'

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
      contributorShare: await getContributorShare(),
    }
  })

  app.get('/public/home', async () => loadHomePage())

  app.get('/plans', async () => {
    const rows = await listBuyerPlans({ includeDisabled: false })
    return { items: rows.map(serializeBuyerPlan) }
  })
}
