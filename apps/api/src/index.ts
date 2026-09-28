import { buildApp } from './app.js'
import { assertProductionSecrets, config } from './config.js'
import { seedCountries } from './lib/geo.js'
import { syncExchangeRates } from './lib/fx.js'
import { syncPayoutRates } from './lib/payout-fx.js'
import { prisma } from './lib/prisma.js'
import { seedLicenseCatalog } from './lib/licenses-seed.js'
import { startMediaWorker } from './lib/media-worker.js'
import { initSentry } from './lib/sentry.js'
import { seedHoldPoliciesForAllCountries } from './lib/policy-decision.js'
import { ensureDefaultRevenuePolicy } from './lib/revenue-policy.js'
import { ensureShareGroups } from './lib/share-formulas.js'

const app = await buildApp()
assertProductionSecrets()
await initSentry()

try {
  await seedCountries()
  await seedHoldPoliciesForAllCountries().catch((err) =>
    app.log.warn({ err }, 'country policy HOLD seed failed'),
  )
  await seedLicenseCatalog()
  await ensureDefaultRevenuePolicy().catch((err) =>
    app.log.warn({ err }, 'RevenuePolicy seed failed'),
  )
  await ensureShareGroups().catch((err) =>
    app.log.warn({ err }, 'ShareFormula group seed failed'),
  )
  if ((await prisma.exchangeRate.count()) === 0) {
    await syncExchangeRates().catch((err) => app.log.warn({ err }, 'initial FX sync failed'))
  }
  await syncPayoutRates().catch((err) => app.log.warn({ err }, 'payout partner rate sync failed'))
  startMediaWorker(app.log)
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
