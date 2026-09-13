import { prisma } from './prisma.js'
import { ALL_COUNTRIES } from '../data/countries.js'

export async function assertContributorCountry(countryCode?: string) {
  if (!countryCode) {
    throw Object.assign(new Error('Contributors must select an African country'), { statusCode: 400 })
  }
  const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } })
  if (!country?.enabled || !country.contributorEligible) {
    throw Object.assign(
      new Error('Vuekumi only accepts contributors from African countries'),
      { statusCode: 400 },
    )
  }
  return country
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
