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

  app.get('/plans', async (request) => {
    const query = request.query as { audience?: string }
    const audience = ['buyer', 'photographer', 'contributor', 'model'].includes(query.audience ?? '')
      ? query.audience
      : 'buyer'
    const [items, home] = await Promise.all([
      listBuyerPlans({ includeDisabled: false, audience }),
      loadHomePricingCopy(),
    ])
    return { items, home, audience }
  })
}
