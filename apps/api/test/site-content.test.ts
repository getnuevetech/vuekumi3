import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_SITE_CONTENT, mergeSiteContent } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('missing site content falls back to the built-in homepage words', () => {
  const content = mergeSiteContent(null)
  assert.equal(content.brand.name, 'Vuekumi')
  assert.equal(content.home.hero.slides[0]?.title, 'AFRICA')
  assert.equal(content.menu.some((link) => link.label === 'Library'), true)
  assert.equal(content.menuStyle.font, 'condensed')
  assert.equal(content.menuStyle.sizePx, 10)
  assert.equal(content.menu[0]?.sort, 1)
  assert.equal(content.accountMenu.some((link) => link.to === '#logout' && link.label === 'Log out'), true)
  assert.deepEqual(mergeSiteContent({
    accountMenu: [
      { label: 'Log out', to: '#logout', audience: 'signed_in', sort: 2 },
      { label: 'Account', to: '/account', audience: 'signed_in', sort: 1 },
    ],
  }).accountMenu.map((link) => link.label), ['Account', 'Log out'])
  assert.equal(mergeSiteContent({ brand: { name: 'Vuekumi' } }).accountMenu[0]?.label, 'Account')
  assert.deepEqual(mergeSiteContent({
    menu: [
      { label: 'Library', to: '/search', audience: 'always', sort: 20 },
      { label: 'Creators', to: '/creators', audience: 'always', sort: 2 },
    ],
  }).menu.slice(0, 2).map((link) => link.label), ['Creators', 'Library'])
})

test('admin can change the public menu and logo words', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const admin = cookies(login)

  const before = await app.inject({ method: 'GET', url: '/api/public/site' })
  assert.equal(before.statusCode, 200, before.body)
  const current = before.json() as { content: typeof DEFAULT_SITE_CONTENT }
  const next = {
    ...current.content,
    brand: { ...current.content.brand, name: 'Vuekumi', accent: 'kumi' },
    home: {
      ...current.content.home,
      categories: { kicker: 'browse by', title: 'Chosen shelves' },
    },
    menu: current.content.menu.map((link) => link.to === '/search' ? { ...link, label: 'Catalogue' } : link),
  }

  const saved = await app.inject({
    method: 'PUT',
    url: '/api/admin/site',
    headers: { cookie: admin },
    payload: next,
  })
  assert.equal(saved.statusCode, 200, saved.body)

  const after = await app.inject({ method: 'GET', url: '/api/public/site' })
  const body = after.json() as { content: { home: { categories: { title: string } }; menu: { label: string; to: string }[] } }
  assert.equal(body.content.home.categories.title, 'Chosen shelves')
  assert.equal(body.content.menu.find((link) => link.to === '/search')?.label, 'Catalogue')

  const rejected = await app.inject({
    method: 'PUT',
    url: '/api/admin/site',
    headers: { cookie: admin },
    payload: { ...next, menu: [{ label: 'Offsite', to: 'https://example.com', audience: 'always' }] },
  })
  assert.equal(rejected.statusCode, 400, rejected.body)

  await prisma.siteContent.deleteMany({ where: { id: 'public' } })
  await app.close()
})
