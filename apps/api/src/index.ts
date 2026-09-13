import { buildApp } from './app.js'
import { config } from './config.js'
import { seedCountries } from './lib/geo.js'
import { syncExchangeRates } from './lib/fx.js'
import { prisma } from './lib/prisma.js'
import { seedLicenseCatalog } from './lib/licenses-seed.js'

const app = await buildApp()

try {
  await seedCountries()
  await seedLicenseCatalog()
  if ((await prisma.exchangeRate.count()) === 0) {
    await syncExchangeRates().catch((err) => app.log.warn({ err }, 'initial FX sync failed'))
  }
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
