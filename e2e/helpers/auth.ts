import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_BASE } from './fixtures'

/** Sign in through the public login form (sets browser cookies). */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByPlaceholder('Email address').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
    page.locator('form').getByRole('button', { name: 'Sign in' }).click(),
  ])
}

/**
 * Login via the web origin (`page.request`) so session cookies attach to the browser context.
 * Prefer this over a direct :3001 call when a later UI navigation needs auth.
 */
export async function browserApiLogin(page: Page, email: string, password: string) {
  const cached = cookieCache.get(`browser:${email}`)
  if (cached) {
    // Re-apply by hitting a lightweight authenticated endpoint through the page jar.
    const me = await page.request.get('/api/auth/me')
    if (me.ok()) return cached
  }

  let lastBody = ''
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await page.request.post('/api/auth/login', {
      data: { email, password },
    })
    if (res.ok()) {
      const cookie = cookieHeaderFromResponse(res)
      cookieCache.set(email, cookie)
      cookieCache.set(`browser:${email}`, cookie)
      return cookie
    }
    lastBody = await res.text()
    if (res.status() === 429) {
      await new Promise((r) => setTimeout(r, 15_000 + attempt * 5_000))
      continue
    }
    break
  }
  expect(false, `browser login ${email}: ${lastBody}`).toBeTruthy()
  return ''
}

export function cookieHeaderFromResponse(res: { headers: () => Record<string, string> }) {
  const raw = res.headers()['set-cookie']
  if (!raw) return ''
  const parts = raw
    .split(/,(?=\s*[^;=]+=)|[\n\r]+/)
    .map((c) => c.split(';')[0]!.trim())
    .filter(Boolean)
  return parts.join('; ')
}

/** Cache API login cookies within a worker to stay under AUTH_RATE_LIMIT. */
const cookieCache = new Map<string, string>()

export function clearApiLoginCache() {
  cookieCache.clear()
}

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const cached = cookieCache.get(email)
  if (cached) return cached

  let lastBody = ''
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email, password },
    })
    if (res.ok()) {
      const cookie = cookieHeaderFromResponse(res)
      cookieCache.set(email, cookie)
      return cookie
    }
    lastBody = await res.text()
    if (res.status() === 429) {
      await new Promise((r) => setTimeout(r, 15_000 + attempt * 5_000))
      continue
    }
    break
  }
  expect(false, `login ${email}: ${lastBody}`).toBeTruthy()
  return ''
}
