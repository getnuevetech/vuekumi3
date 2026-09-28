import { prisma } from '../../src/lib/prisma.js'

const KEY = 'geo.contributor_onboarding_policy'
/** Stable advisory-lock key so parallel files do not race the onboarding setting. */
const LOCK_KEY = 28160001

async function withOnboardingLock<T>(fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRaw`SELECT pg_advisory_lock(${LOCK_KEY})`
  try {
    return await fn()
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${LOCK_KEY})`
  }
}

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

/** Temporarily restore AU-list-only signup for tests that register full contributors on HOLD markets. */
export async function withAfricaListOnboarding<T>(fn: () => Promise<T>): Promise<T> {
  return withOnboardingLock(async () => {
    const prev = await prisma.platformSetting.findUnique({ where: { key: KEY } })
    await setOnboardingPolicy('africa_list')
    try {
      return await fn()
    } finally {
      await setOnboardingPolicy(prev?.value ?? 'africa_list_and_country_active')
    }
  })
}

/** Hold Dec-AfricaElig default for the duration of PDS / waitlist assertions. */
export async function withStrictOnboardingPolicy<T>(fn: () => Promise<T>): Promise<T> {
  return withOnboardingLock(async () => {
    const prev = await prisma.platformSetting.findUnique({ where: { key: KEY } })
    await setOnboardingPolicy('africa_list_and_country_active')
    try {
      return await fn()
    } finally {
      await setOnboardingPolicy(prev?.value ?? 'africa_list_and_country_active')
    }
  })
}

/** @deprecated prefer withStrictOnboardingPolicy so the lock is held for the whole assertion block */
export async function ensureStrictOnboardingPolicy() {
  return withOnboardingLock(async () => {
    await setOnboardingPolicy('africa_list_and_country_active')
  })
}
