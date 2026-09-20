import { prisma } from './prisma.js'
import { ALL_COUNTRIES } from '../data/countries.js'
import { assertContributorCountryViaPds } from './policy-decision.js'

/** Contributor signup / create — delegates to Policy Decision Service (Phase 49 / P0). */
export async function assertContributorCountry(countryCode?: string) {
  return assertContributorCountryViaPds(countryCode)
}

export async function seedCountries() {
  for (const c of ALL_COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        currency: c.currency,
        currencyName: c.currencyName,
        region: c.region,
        contributorEligible: c.contributorEligible,
        sortOrder: c.sortOrder ?? (c.region === 'africa' ? 10 : 50),
      },
      update: {},
    })
  }
}
