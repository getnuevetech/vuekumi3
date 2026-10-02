import { expect, test } from '@playwright/test'
import { browserApiLogin, signIn } from './helpers/auth'

test.describe('Phase 45 + 55 web smoke', () => {
  test('home shows Vuekumi brand and library CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /Vuekumi/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explore the library' })).toBeVisible()
  })

  test('catalog library page loads', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByRole('heading', { name: 'The library' })).toBeVisible()
    await expect(page.getByPlaceholder('Search Africa…').first()).toBeVisible()
  })

  test('models directory and seed profile load', async ({ page }) => {
    await page.goto('/models')
    await expect(page.getByRole('heading', { name: 'Models.' })).toBeVisible()

    await page.goto('/m/ada-molefe')
    await expect(page.getByRole('heading', { name: 'Ada Molefe' })).toBeVisible()
    await expect(page.getByText(/@ada-molefe · Gaborone/i).first()).toBeVisible()
    await expect(page.getByText(/Verified Model/i).first()).toBeVisible()
  })

  test('pricing, legal, and DMCA public pages load', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByText('Vuekumi+').first()).toBeVisible()

    await page.goto('/legal')
    await expect(page.getByRole('heading', { name: 'Global Rights Standard.' })).toBeVisible()

    await page.goto('/dmca')
    await expect(page.getByRole('heading', { name: 'DMCA notices.' })).toBeVisible()
  })

  test('Phase 55: report-content and rights hubs load', async ({ page }) => {
    await page.goto('/report-content')
    await expect(page.getByRole('heading', { name: 'Report content.' })).toBeVisible()
    await expect(page.getByText('Photograph link')).toBeVisible()
    await expect(page.getByRole('link', { name: 'DMCA notice' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Your rights' })).toBeVisible()

    await page.goto('/report-content?photoUrl=/photo/afr-002')
    await expect(page.getByPlaceholder(/photo\/afr-001/i)).toHaveValue(/afr-002/)

    await page.goto('/rights')
    await expect(page.getByRole('heading', { name: 'Your rights.' })).toBeVisible()
    await expect(page.getByText('Open an invite')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Report content →' })).toBeVisible()
    await expect(page.getByText(/likeness compensation can be negotiated/i)).toBeVisible()
  })

  test('Phase 55: seed likeness invite opens on rights hub', async ({ page }) => {
    // Use seed-e2e-rights-invite — API tests claim seed-nomsa-model-invite.
    await page.goto('/rights?token=seed-e2e-rights-invite')
    await expect(page.getByRole('heading', { name: 'Your rights.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Likeness consent' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve selected' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible()
    await expect(page.getByText(/Models do not earn/i)).toBeVisible()
  })

  test('Phase 55: legacy model invite URL redirects into rights hub', async ({ page }) => {
    await page.goto('/invite/model/seed-e2e-rights-invite')
    await expect(page).toHaveURL(/\/rights\?token=seed-e2e-rights-invite/)
    await expect(page.getByRole('heading', { name: 'Likeness consent' })).toBeVisible()
  })

  test('admin can sign in and reach platform health', async ({ page }) => {
    await signIn(page, 'admin@vuekumi.com', 'Admin123!')
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByText('Admin portal')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Platform health.' })).toBeVisible()
    await expect(page.getByText('Total users')).toBeVisible()
  })

  test('member can open bookings after sign-in', async ({ page }) => {
    await browserApiLogin(page, 'member@vuekumi.demo', 'User12345!')
    await page.goto('/bookings')
    await expect(page.getByRole('heading', { name: /Briefs/i })).toBeVisible()
  })

  test('D-R2: home search and featured sections load', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Africa/i }).first()).toBeVisible()
    await expect(page.getByPlaceholder(/Search photos/i).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Featured Photos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Latest from the Library' })).toBeVisible()
  })

  test('D-R3: home spotlight Digital ID opens public card', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Contributor Spotlight' })).toBeVisible()
    const digitalId = page.getByRole('link', { name: /VueKumi Digital ID/i }).first()
    await expect(digitalId).toBeVisible()
    await digitalId.click()
    await expect(page).toHaveURL(/\/id\//)
    await expect(page.getByText(/VueKumi Digital ID/i).first()).toBeVisible()
  })

  test('D-R2: library filters update the URL', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByRole('heading', { name: 'The library' })).toBeVisible()
    await page.getByRole('button', { name: 'Free Library' }).click()
    await expect(page).toHaveURL(/libraryTier=OPEN/)
    await expect(page.getByText(/Free Library \(Open\)/i)).toBeVisible()
  })

  test('D-R2: category hero and photo license panel load', async ({ page }) => {
    await page.goto('/category/landscape')
    await expect(page.getByRole('heading', { name: /Landscape/i }).first()).toBeVisible()

    await page.goto('/photo/afr-001')
    await expect(page.getByText(/Usage permission/i)).toBeVisible()
    await expect(page.locator('img').first()).toBeVisible()
  })

  test('D-R3: photo influencer profile shows Open Creator without license performance', async ({ page }) => {
    await page.goto('/p/amara-okafor')
    await expect(page.getByRole('heading', { name: /Amara/i }).first()).toBeVisible()
    await expect(page.getByText(/Open Creator/i).first()).toBeVisible()
    await expect(page.getByText(/Upgrade account/i)).toBeVisible()
    await expect(page.getByText(/Digital ID/i).first()).toBeVisible()
    await expect(page.getByText(/Top licensed work/i)).toHaveCount(0)
  })

  test('D-R3: photographer premium header and model directory cards', async ({ page }) => {
    await page.goto('/p/thandiwe-nkosi')
    await expect(page.getByRole('heading', { name: /Thandiwe/i }).first()).toBeVisible()
    await expect(page.getByText(/Digital ID/i).first()).toBeVisible()

    await page.goto('/models')
    await expect(page.getByRole('heading', { name: 'Models.' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ada Molefe/i }).first()).toBeVisible()

    await page.goto('/m/ada-molefe')
    await expect(page.getByRole('heading', { name: 'Ada Molefe' })).toBeVisible()
    await expect(page.getByText(/Verified Model/i).first()).toBeVisible()
  })

  test('D-R3: digital ID page has no private fields', async ({ page }) => {
    await page.goto('/p/amara-okafor')
    await page.getByRole('link', { name: /Digital ID/i }).first().click()
    await expect(page).toHaveURL(/\/id\//)
    await expect(page.getByText(/VueKumi Digital ID/i).first()).toBeVisible()
    await expect(page.getByText(/Open Creator/i).first()).toBeVisible()
    await expect(page.getByText(/@vuekumi\.demo/i)).toHaveCount(0)
    await expect(page.getByText(/Admin123/i)).toHaveCount(0)
  })
})
