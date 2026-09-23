import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { narrateCatalogEngagement } from '../src/lib/analytics-report.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('catalog narration is read-only copy from stored counts', () => {
  const lines = narrateCatalogEngagement({
    views: 12,
    favorites: 3,
    licences: 1,
    topCategory: 'Landscape',
    moderationOlderThan7Days: 2,
  })
  assert.match(lines[0] ?? '', /12 views, 3 favorites, and 1 licences/)
  assert.match(lines.join(' '), /Landscape/)
  assert.match(lines.join(' '), /read-only/i)
  assert.equal(lines.some((line) => /deny|suspend|delete/i.test(line)), false)
})

test('Phase 63: contributor stats and admin overview report engagement without changing a photograph', async () => {
  const app = await buildApp()
  const photographer = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'kofi-mensah@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(photographer.statusCode, 200, photographer.body)
  const stats = await app.inject({
    method: 'GET',
    url: '/api/contributor/stats',
    headers: { cookie: cookies(photographer) },
  })
  assert.equal(stats.statusCode, 200, stats.body)
  const body = stats.json() as {
    views: number
    favorites: number
    licences: number
    report: string[]
  }
  assert.equal(typeof body.views, 'number')
  assert.equal(typeof body.favorites, 'number')
  assert.ok(body.favorites >= 0)
  assert.ok(body.licences >= 0)
  assert.ok(body.report.some((line) => /read-only/i.test(line)))

  const admin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(admin.statusCode, 200, admin.body)
  const overview = await app.inject({
    method: 'GET',
    url: '/api/admin/metrics/overview',
    headers: { cookie: cookies(admin) },
  })
  assert.equal(overview.statusCode, 200, overview.body)
  const metrics = overview.json() as {
    stats: {
      catalogViews: number
      catalogFavorites: number
      licencesIssued: number
      moderationOlderThan7Days: number
    }
    engagementReport: string[]
  }
  assert.equal(typeof metrics.stats.catalogViews, 'number')
  assert.ok(metrics.stats.catalogFavorites >= 0)
  assert.ok(metrics.stats.licencesIssued >= 0)
  assert.ok(metrics.stats.moderationOlderThan7Days >= 0)
  assert.ok(metrics.engagementReport.some((line) => /read-only/i.test(line)))
  await app.close()
})
