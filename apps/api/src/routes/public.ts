import type { FastifyInstance } from 'fastify'
import { config } from '../config.js'
import { googleOAuthConfigured } from '../lib/oauth.js'
import { getSettingSafe } from '../lib/settings.js'
import { getContributorShare } from '../lib/payments-config.js'
import { listBuyerPlans, loadHomePricingCopy } from '../lib/buyer-plans.js'
import { loadHomePage } from '../lib/home-queries.js'
import { loadSitePublic } from '../lib/site-content.js'

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

  app.get('/public/site', async () => loadSitePublic())

  app.get('/plans', async () => {
    const [items, home] = await Promise.all([
      listBuyerPlans({ includeDisabled: false }),
      loadHomePricingCopy(),
    ])
    return { items, home }
  })
}
