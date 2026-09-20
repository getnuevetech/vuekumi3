import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByPlaceholder('Email address').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login')),
    page.locator('form').getByRole('button', { name: 'Sign in' }).click(),
  ])
}

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
    await expect(page.getByText('@ada-molefe')).toBeVisible()
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
    await expect(page.getByRole('link', { name: 'Your rights' })).toBeVisible()

    await page.goto('/report-content?photoUrl=/photo/afr-002')
    await expect(page.getByPlaceholder(/photo\/afr-001/i)).toHaveValue(/afr-002/)

    await page.goto('/rights')
    await expect(page.getByRole('heading', { name: 'Your rights.' })).toBeVisible()
    await expect(page.getByText('Open an invite')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Report content →' })).toBeVisible()
    await expect(page.getByText(/Compensation negotiation is not on this hub/i)).toBeVisible()
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
    await signIn(page, 'member@vuekumi.demo', 'User12345!')
    await page.goto('/bookings')
    await expect(page.getByRole('heading', { name: /Briefs/i })).toBeVisible()
  })
})
