import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AGENCY_PROTECTED_REVERT_STATE,
  canMarkAgencyProtected,
  representationActionBlocked,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}`)
  return cookies(res)
}

test('representation guard: transition matrix and actor roles', () => {
  // A contributor with no record can request; pending and active states cannot.
  assert.equal(representationActionBlocked({ action: 'request', current: null, actor: 'contributor' }), null)
  assert.equal(representationActionBlocked({ action: 'request', current: 'declined', actor: 'contributor' }), null)
  assert.equal(representationActionBlocked({ action: 'request', current: 'ended', actor: 'contributor' }), null)
  assert.equal(representationActionBlocked({ action: 'request', current: 'withdrawn', actor: 'contributor' }), null)
  assert.equal(representationActionBlocked({ action: 'request', current: 'requested', actor: 'contributor' })!.status, 400)
  assert.equal(representationActionBlocked({ action: 'request', current: 'represented', actor: 'contributor' })!.status, 400)

  // Withdraw only while pending; end only while represented.
  assert.equal(representationActionBlocked({ action: 'withdraw', current: 'requested', actor: 'contributor' }), null)
  assert.equal(representationActionBlocked({ action: 'withdraw', current: 'represented', actor: 'contributor' })!.status, 400)
  assert.equal(representationActionBlocked({ action: 'end', current: 'represented', actor: 'contributor' }), null)
  assert.equal(representationActionBlocked({ action: 'end', current: 'represented', actor: 'admin' }), null)
  assert.equal(representationActionBlocked({ action: 'end', current: 'requested', actor: 'admin' })!.status, 400)

  // Only staff decide; only pending requests are decidable.
  assert.equal(representationActionBlocked({ action: 'approve', current: 'requested', actor: 'admin' }), null)
  assert.equal(representationActionBlocked({ action: 'decline', current: 'requested', actor: 'admin' }), null)
  assert.equal(representationActionBlocked({ action: 'approve', current: 'requested', actor: 'contributor' })!.status, 403)
  assert.equal(representationActionBlocked({ action: 'approve', current: 'represented', actor: 'admin' })!.status, 400)
  assert.equal(representationActionBlocked({ action: 'request', current: null, actor: 'admin' })!.status, 403)

  // agency_protected only while represented; revert state invents no clearance.
  assert.equal(canMarkAgencyProtected('represented'), true)
  for (const s of ['requested', 'declined', 'ended', 'withdrawn', null] as const) {
    assert.equal(canMarkAgencyProtected(s), false)
  }
  assert.equal(AGENCY_PROTECTED_REVERT_STATE, 'portfolio')
})

test('representation lifecycle: request → withdraw → re-request → approve → protect → inquire → end → revert', async () => {
  const app = await buildApp()
  const kofi = await login(app, 'kofi-mensah@vuekumi.demo', 'User12345!')
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')

  const kofiUser = await prisma.user.findUniqueOrThrow({ where: { email: 'kofi-mensah@vuekumi.demo' } })
  const photo = await prisma.photo.findFirstOrThrow({
    where: { contributorId: kofiUser.id, status: 'active' },
  })
  const originalState = photo.permissionState
  const originalExclusive = photo.exclusiveAvailable

  try {
    // Before any representation, staff cannot mark inventory agency-protected.
    const early = await app.inject({
      method: 'PATCH',
      url: `/api/admin/content/${photo.id}/rights`,
      headers: { cookie: admin },
      payload: { permissionState: 'agency_protected' },
    })
    assert.equal(early.statusCode, 400, early.body)
    assert.match((early.json() as { error: string }).error, /representation/)

    // Request, withdraw, re-request.
    const first = await app.inject({
      method: 'POST',
      url: '/api/representation',
      headers: { cookie: kofi },
      payload: { note: 'Interested in VueQuatro handling my commercial campaign work.' },
    })
    assert.equal(first.statusCode, 200, first.body)
    assert.equal((first.json() as { representation: { status: string } }).representation.status, 'requested')

    const dupe = await app.inject({ method: 'POST', url: '/api/representation', headers: { cookie: kofi }, payload: {} })
    assert.equal(dupe.statusCode, 400)

    const withdrawn = await app.inject({ method: 'POST', url: '/api/representation/withdraw', headers: { cookie: kofi } })
    assert.equal(withdrawn.statusCode, 200, withdrawn.body)

    const again = await app.inject({ method: 'POST', url: '/api/representation', headers: { cookie: kofi }, payload: {} })
    assert.equal(again.statusCode, 200, again.body)

    // Staff approve from the queue.
    const queue = await app.inject({ method: 'GET', url: '/api/admin/representation', headers: { cookie: admin } })
    const row = (queue.json() as { items: { id: string; contributorEmail: string; status: string }[] }).items
      .find((r) => r.contributorEmail === 'kofi-mensah@vuekumi.demo')
    assert.ok(row, 'request visible in staff queue')
    assert.equal(row!.status, 'requested')

    const approved = await app.inject({
      method: 'POST',
      url: `/api/admin/representation/${row!.id}/decide`,
      headers: { cookie: admin },
      payload: { action: 'approve', staffNote: 'Portfolio quality is strong.' },
    })
    assert.equal(approved.statusCode, 200, approved.body)

    // Public profile now carries the representation flag.
    const kofiProfile = await prisma.contributorProfile.findUniqueOrThrow({ where: { userId: kofiUser.id } })
    const pub = await app.inject({ method: 'GET', url: `/api/photographers/${kofiProfile.handle}` })
    assert.equal((pub.json() as { photographer: { represented: boolean } }).photographer.represented, true)

    // Now agency-protected sticks.
    const protect = await app.inject({
      method: 'PATCH',
      url: `/api/admin/content/${photo.id}/rights`,
      headers: { cookie: admin },
      payload: { permissionState: 'agency_protected' },
    })
    assert.equal(protect.statusCode, 200, protect.body)

    // Self-serve licensing is blocked; buyers inquire instead.
    const inquiry = await app.inject({
      method: 'POST',
      url: `/api/photos/${photo.id}/inquiry`,
      payload: {
        name: 'Adaeze Brand Studio',
        email: 'production@adaeze.example',
        company: 'Adaeze',
        message: 'We want a 12-month out-of-home campaign licence for West Africa.',
      },
    })
    assert.equal(inquiry.statusCode, 200, inquiry.body)

    const adminView = await app.inject({ method: 'GET', url: '/api/admin/representation', headers: { cookie: admin } })
    const view = adminView.json() as {
      items: { contributorEmail: string; status: string; protectedCount: number }[]
      inquiries: { photoId: string; email: string; status: string }[]
    }
    const represented = view.items.find((r) => r.contributorEmail === 'kofi-mensah@vuekumi.demo')
    assert.equal(represented?.status, 'represented')
    assert.ok((represented?.protectedCount ?? 0) >= 1)
    const q = view.inquiries.find((i) => i.photoId === photo.id && i.email === 'production@adaeze.example')
    assert.ok(q, 'inquiry reaches the staff queue')

    // Inquiries only exist for agency-protected photographs.
    const otherPhoto = await prisma.photo.findFirst({
      where: { status: 'active', permissionState: 'commercial', id: { not: photo.id } },
    })
    if (otherPhoto) {
      const wrong = await app.inject({
        method: 'POST',
        url: `/api/photos/${otherPhoto.id}/inquiry`,
        payload: { name: 'X', email: 'x@example.com', message: 'This should be a normal checkout.' },
      })
      assert.equal(wrong.statusCode, 400)
    }

    // Ending representation reverts protected inventory to portfolio.
    const ended = await app.inject({
      method: 'POST',
      url: '/api/representation/end',
      headers: { cookie: kofi },
    })
    assert.equal(ended.statusCode, 200, ended.body)
    assert.ok((ended.json() as { revertedPhotos: number }).revertedPhotos >= 1)

    const after = await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } })
    assert.equal(after.permissionState, 'portfolio')
  } finally {
    await prisma.photo.update({
      where: { id: photo.id },
      data: { permissionState: originalState, exclusiveAvailable: originalExclusive },
    })
    await prisma.representation.deleteMany({ where: { contributorId: kofiUser.id } })
  }
})
