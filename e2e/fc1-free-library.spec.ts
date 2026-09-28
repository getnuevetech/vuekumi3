import { expect, test } from '@playwright/test'
import { apiLogin, browserApiLogin, clearApiLoginCache } from './helpers/auth'
import { prisma, submitContributorPhoto } from './helpers/api'
import { API_BASE, SEED } from './helpers/fixtures'

/**
 * FC1-7 — Free Library / Dec-TierMap Playwright invariants.
 * Complements API Dec-TierMap unit/integration coverage with UI footholds
 * and seeded-account upload enforcement.
 */
test.describe('FC1 Free Library / Dec-TierMap', () => {
  test.beforeAll(() => {
    clearApiLoginCache()
  })
  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('public Free Library nav opens Open-tier search', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation').getByRole('link', { name: 'Free Library' }).click()
    await expect(page).toHaveURL(/libraryTier=OPEN/)
    await expect(page.getByRole('heading', { name: 'The library' })).toBeVisible()
    await expect(page.getByText(/Free Library \(Open\)/i)).toBeVisible()
  })

  test('Photo Influencer dashboard shows Free Library CTAs (no forced upgrade)', async ({ page }) => {
    await browserApiLogin(page, SEED.photoInfluencer.email, SEED.photoInfluencer.password)
    await page.goto('/contributor')
    await expect(page.getByText('Free Library').first()).toBeVisible()
    await expect(page.getByText(/You upload only to the Free Library/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Upload to Free Library' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upgrade to Photographer' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upgrade to Contributor' })).toBeVisible()
    // Do not click upgrade — seed Amara must stay photo_influencer for other suites.
  })

  test('Photo Influencer upload lands on Free Library; premium commercial is blocked', async ({ request }) => {
    const cookie = await apiLogin(request, SEED.photoInfluencer.email, SEED.photoInfluencer.password)
    const uploaded = await submitContributorPhoto(request, cookie, {
      title: `FC1 Free Library ${Date.now()}`,
      category: 'Urban',
      country: 'Nigeria',
      licenseType: 'free',
      hasRecognizablePeople: false,
      copyrightHolder: 'Amara Okafor',
      copyrightAttested: true,
      permissionState: 'editorial',
    })
    expect(uploaded.photo.libraryTier).toBe('OPEN')

    const premium = await request.post(`${API_BASE}/api/contributor/photos`, {
      headers: { cookie },
      data: {
        title: `FC1 premium blocked ${Date.now()}`,
        category: 'Fashion',
        country: 'Nigeria',
        licenseType: 'premium',
        hasRecognizablePeople: false,
        copyrightHolder: 'Amara Okafor',
        copyrightAttested: true,
        permissionState: 'commercial',
      },
    })
    expect(premium.status()).toBe(400)
    const body = await premium.json() as { error?: string }
    expect(body.error ?? '').toMatch(/Free Library|Photo influencers/i)
  })

  test('Photographer free upload never lands on Free Library', async ({ request }) => {
    const cookie = await apiLogin(request, SEED.photographer.email, SEED.photographer.password)
    const uploaded = await submitContributorPhoto(request, cookie, {
      title: `FC1 paid tier ${Date.now()}`,
      category: 'Urban',
      country: 'South Africa',
      licenseType: 'free',
      hasRecognizablePeople: false,
      copyrightHolder: 'Thandiwe Nkosi',
      copyrightAttested: true,
      permissionState: 'editorial',
    })
    expect(uploaded.photo.libraryTier).not.toBe('OPEN')
    expect(['LICENSED', 'EDITORIAL', 'VERIFIED_PLUS']).toContain(uploaded.photo.libraryTier)
  })

  test('Admin Free Library content filter surfaces review queue', async ({ page }) => {
    await browserApiLogin(page, SEED.admin.email, SEED.admin.password)
    await page.goto('/admin/content?libraryTier=OPEN')
    await expect(page).toHaveURL(/libraryTier=OPEN/)
    await expect(page.getByRole('heading', { name: 'Free Library review.' })).toBeVisible()
    await expect(page.getByText(/in Free Library/i)).toBeVisible()
    // Sidebar shortcut stays available while reviewing Free Library.
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Free Library' })).toBeVisible()
  })
})
