import { prisma } from '../../src/lib/prisma.js'

const KEY = 'geo.contributor_onboarding_policy'

async function setOnboardingPolicy(value: string) {
  await prisma.platformSetting.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      value,
      secret: false,
      label: 'Contributor onboarding policy',
      group: 'Geo / Country policy',
    },
    update: { value },
  })
}

/**
 * Temporarily restore AU-list-only signup for tests that register full contributors on HOLD markets.
 * Requires serial test concurrency (`--test-concurrency=1`) so the setting is not raced.
 */
export async function withAfricaListOnboarding<T>(fn: () => Promise<T>): Promise<T> {
  const prev = await prisma.platformSetting.findUnique({ where: { key: KEY } })
  await setOnboardingPolicy('africa_list')
  try {
    return await fn()
  } finally {
    await setOnboardingPolicy(prev?.value ?? 'africa_list_and_country_active')
  }
}

/** Hold Dec-AfricaElig default for the duration of PDS / waitlist assertions. */
export async function withStrictOnboardingPolicy<T>(fn: () => Promise<T>): Promise<T> {
  const prev = await prisma.platformSetting.findUnique({ where: { key: KEY } })
  await setOnboardingPolicy('africa_list_and_country_active')
  try {
    return await fn()
  } finally {
    await setOnboardingPolicy(prev?.value ?? 'africa_list_and_country_active')
  }
}
