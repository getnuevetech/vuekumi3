import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyShareFormula, DEFAULT_SHARE_FORMULA, type ShareAdminDto } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('share formulas pay a percentage, a fixed amount, or both, and never more than the sale', () => {
  assert.equal(applyShareFormula(10, DEFAULT_SHARE_FORMULA), 5)
  assert.equal(applyShareFormula(10, { mode: 'percentage', percent: 0, fixedUsd: 4 }), 0)
  assert.equal(applyShareFormula(10, { mode: 'fixed', percent: 80, fixedUsd: 4 }), 4)
  assert.equal(applyShareFormula(10, { mode: 'fixed', percent: 0, fixedUsd: 25 }), 10)
  assert.equal(applyShareFormula(10, { mode: 'both', percent: 50, fixedUsd: 2 }), 7)
  assert.equal(applyShareFormula(10, { mode: 'both', percent: 80, fixedUsd: 8 }), 10)
  assert.equal(applyShareFormula(0, { mode: 'fixed', percent: 0, fixedUsd: 5 }), 0)
})

test('admin can set a group formula and a different formula on one account', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const admin = cookies(login)

  const listed = await app.inject({ method: 'GET', url: '/api/admin/shares', headers: { cookie: admin } })
  assert.equal(listed.statusCode, 200, listed.body)
  const before = listed.json() as ShareAdminDto
  assert.equal(before.groups.find((group) => group.groupKey === 'photographer')?.percent, 50)

  const saved = await app.inject({
    method: 'PUT',
    url: '/api/admin/shares/groups/photographer',
    headers: { cookie: admin },
    payload: { mode: 'both', percent: 40, fixedUsd: 1 },
  })
  assert.equal(saved.statusCode, 200, saved.body)
  const next = saved.json() as ShareAdminDto
  assert.equal(next.groups.find((group) => group.groupKey === 'photographer')?.mode, 'both')

  const search = await app.inject({
    method: 'GET',
    url: '/api/admin/shares/accounts?q=amara',
    headers: { cookie: admin },
  })
  assert.equal(search.statusCode, 200, search.body)
  const account = (search.json() as { items: { userId: string }[] }).items[0]
  assert.ok(account?.userId)

  const personal = await app.inject({
    method: 'PUT',
    url: '/api/admin/shares/accounts',
    headers: { cookie: admin },
    payload: { userId: account.userId, mode: 'fixed', percent: 0, fixedUsd: 3 },
  })
  assert.equal(personal.statusCode, 200, personal.body)
  const withOverride = personal.json() as ShareAdminDto
  assert.equal(withOverride.overrides.some((row) => row.userId === account.userId && row.mode === 'fixed'), true)

  const cleared = await app.inject({
    method: 'DELETE',
    url: `/api/admin/shares/accounts/${account.userId}`,
    headers: { cookie: admin },
  })
  assert.equal(cleared.statusCode, 200, cleared.body)
  assert.equal((cleared.json() as ShareAdminDto).overrides.some((row) => row.userId === account.userId), false)

  const restored = await app.inject({
    method: 'PUT',
    url: '/api/admin/shares/groups/photographer',
    headers: { cookie: admin },
    payload: DEFAULT_SHARE_FORMULA,
  })
  assert.equal(restored.statusCode, 200, restored.body)
  await app.close()
})
