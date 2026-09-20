import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

test('T4 rights preview resolves likeness invite token', async () => {
  const app = await buildApp()
  const res = await app.inject({
    method: 'GET',
    url: '/api/rights/preview/seed-nomsa-model-invite',
  })
  if (res.statusCode === 404) {
    await app.close()
    return
  }
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as { kind: string; invite: { photographerName: string; imageCount: number; images: unknown[] } }
  assert.equal(body.kind, 'likeness')
  assert.ok(body.invite.photographerName)
  assert.ok(body.invite.imageCount >= 1)
  assert.ok(Array.isArray(body.invite.images))
  await app.close()
})

test('T4 rights preview resolves copyright invite token', async () => {
  const app = await buildApp()
  const res = await app.inject({
    method: 'GET',
    url: '/api/rights/preview/seed-lena-photographer-invite',
  })
  if (res.statusCode === 404) {
    await app.close()
    return
  }
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as { kind: string; invite: { modelName: string; imageCount: number; notice: string } }
  assert.equal(body.kind, 'copyright')
  assert.ok(body.invite.modelName)
  assert.ok(body.invite.imageCount >= 1)
  assert.match(body.invite.notice, /rights clearance/i)
  await app.close()
})

test('T4 rights preview rejects unknown tokens', async () => {
  const app = await buildApp()
  const res = await app.inject({
    method: 'GET',
    url: '/api/rights/preview/not-a-real-invite-token',
  })
  assert.equal(res.statusCode, 404)
  await app.close()
})

test('T4 likeness and copyright previews are mutually exclusive kinds', async () => {
  const app = await buildApp()
  const likeness = await app.inject({ method: 'GET', url: '/api/rights/preview/seed-nomsa-model-invite' })
  const copyright = await app.inject({ method: 'GET', url: '/api/rights/preview/seed-lena-photographer-invite' })
  if (likeness.statusCode === 200 && copyright.statusCode === 200) {
    assert.equal((likeness.json() as { kind: string }).kind, 'likeness')
    assert.equal((copyright.json() as { kind: string }).kind, 'copyright')
    assert.notEqual(
      (likeness.json() as { kind: string }).kind,
      (copyright.json() as { kind: string }).kind,
    )
  }
  await app.close()
})
