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

test.describe('Phase 45 web smoke', () => {
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
