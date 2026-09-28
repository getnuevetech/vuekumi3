import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('staff can publish a creator brief from opportunity demand', async () => {
  const app = await buildApp()
  const admin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(admin.statusCode, 200)
  const cookie = cookies(admin)

  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/creator-briefs',
    headers: { cookie },
    payload: {
      title: 'Brief: Lagos night market',
      body: 'Upload night market frames.',
      sourceLabel: 'Lagos night market',
      category: 'Urban',
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const brief = (created.json() as { brief: { id: string; title: string } }).brief
  assert.match(brief.title, /Lagos/)

  const influencer = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(influencer.statusCode, 200)
  const list = await app.inject({
    method: 'GET',
    url: '/api/contributor/briefs',
    headers: { cookie: cookies(influencer) },
  })
  assert.equal(list.statusCode, 200, list.body)
  const items = (list.json() as { items: { id: string }[] }).items
  assert.ok(items.some((row) => row.id === brief.id))

  await prisma.creatorBrief.delete({ where: { id: brief.id } }).catch(() => {})
  await app.close()
})
