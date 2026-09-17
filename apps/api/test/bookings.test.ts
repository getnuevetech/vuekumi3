import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bookingActionBlocked, bookingCreateBlocked } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: email === 'admin@vuekumi.com' ? 'Admin123!' : 'User12345!' },
  })
  assert.equal(res.statusCode, 200, `login ${email}`)
  return cookies(res)
}

test('booking create guard: missing, self, and unavailable creators are blocked', () => {
  assert.deepEqual(
    bookingCreateBlocked({ targetFound: false, targetActive: false, availability: 'open', isSelf: false }),
    { status: 404, error: 'Creator not found' },
  )
  assert.deepEqual(
    bookingCreateBlocked({ targetFound: true, targetActive: false, availability: 'open', isSelf: false }),
    { status: 404, error: 'Creator not found' },
  )
  assert.equal(
    bookingCreateBlocked({ targetFound: true, targetActive: true, availability: 'limited', isSelf: false }),
    null,
  )
  assert.match(
    bookingCreateBlocked({ targetFound: true, targetActive: true, availability: 'open', isSelf: true })!.error,
    /yourself/,
  )
  assert.match(
    bookingCreateBlocked({ targetFound: true, targetActive: true, availability: 'unavailable', isSelf: false })!.error,
    /not taking bookings/,
  )
})

test('booking action guard: roles and transitions', () => {
  // Only the creator answers; only the requester accepts or withdraws.
  assert.equal(bookingActionBlocked({ action: 'quote', status: 'pending', isTarget: false, isRequester: true })!.status, 403)
  assert.equal(bookingActionBlocked({ action: 'decline', status: 'pending', isTarget: false, isRequester: true })!.status, 403)
  assert.equal(bookingActionBlocked({ action: 'accept', status: 'quoted', isTarget: true, isRequester: false })!.status, 403)
  assert.equal(bookingActionBlocked({ action: 'withdraw', status: 'pending', isTarget: true, isRequester: false })!.status, 403)

  // Transitions.
  assert.equal(bookingActionBlocked({ action: 'quote', status: 'pending', isTarget: true, isRequester: false }), null)
  assert.equal(bookingActionBlocked({ action: 'quote', status: 'quoted', isTarget: true, isRequester: false })!.status, 400)
  assert.equal(bookingActionBlocked({ action: 'accept', status: 'pending', isTarget: false, isRequester: true })!.status, 400)
  assert.equal(bookingActionBlocked({ action: 'accept', status: 'quoted', isTarget: false, isRequester: true }), null)
  assert.equal(bookingActionBlocked({ action: 'decline', status: 'quoted', isTarget: true, isRequester: false }), null)
  assert.equal(bookingActionBlocked({ action: 'withdraw', status: 'quoted', isTarget: false, isRequester: true }), null)

  // Decided bookings are final.
  for (const status of ['accepted', 'declined', 'withdrawn'] as const) {
    assert.equal(bookingActionBlocked({ action: 'decline', status, isTarget: true, isRequester: false })!.status, 400)
    assert.equal(bookingActionBlocked({ action: 'withdraw', status, isTarget: false, isRequester: true })!.status, 400)
    assert.equal(bookingActionBlocked({ action: 'accept', status, isTarget: false, isRequester: true })!.status, 400)
  }
})

test('hire a photographer: brief → quote → accept, no ledger and no payment rows', async () => {
  const app = await buildApp()
  const member = await login(app, 'member@vuekumi.demo')
  const kofi = await login(app, 'kofi-mensah@vuekumi.demo')

  const created = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { cookie: member },
    payload: {
      kind: 'photographer',
      handle: 'kofi-mensah',
      title: 'Accra fintech brand shoot',
      brief: 'Two-day shoot covering the office, the team, and street portraits for a launch campaign.',
      location: 'Accra, Ghana',
      startDate: '2026-10-12',
      endDate: '2026-10-13',
      budgetUsd: 900,
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const booking = (created.json() as { booking: { id: string; status: string; role: string } }).booking
  assert.equal(booking.status, 'pending')
  assert.equal(booking.role, 'sent')

  // The requester cannot quote their own request.
  const wrongQuote = await app.inject({
    method: 'POST',
    url: `/api/bookings/${booking.id}/quote`,
    headers: { cookie: member },
    payload: { quoteUsd: 100 },
  })
  assert.equal(wrongQuote.statusCode, 403)

  const quoted = await app.inject({
    method: 'POST',
    url: `/api/bookings/${booking.id}/quote`,
    headers: { cookie: kofi },
    payload: { quoteUsd: 1200, note: 'Includes an assistant and edited selects within 10 days.' },
  })
  assert.equal(quoted.statusCode, 200, quoted.body)
  assert.equal((quoted.json() as { booking: { status: string; quoteUsd: number } }).booking.quoteUsd, 1200)

  const accepted = await app.inject({
    method: 'POST',
    url: `/api/bookings/${booking.id}/accept`,
    headers: { cookie: member },
    payload: {},
  })
  assert.equal(accepted.statusCode, 200, accepted.body)
  assert.equal((accepted.json() as { booking: { status: string } }).booking.status, 'accepted')

  // Undecided commission — booking money never touches the platform rails.
  const kofiRows = await prisma.earningsLedger.count({
    where: { contributor: { email: 'kofi-mensah@vuekumi.demo' }, createdAt: { gte: new Date(Date.now() - 60_000) } },
  })
  assert.equal(kofiRows, 0, 'accepting a booking must not create earnings')

  // Both parties see it with the right role.
  const kofiList = await app.inject({ method: 'GET', url: '/api/bookings', headers: { cookie: kofi } })
  const received = (kofiList.json() as { items: { id: string; role: string }[] }).items.find((b) => b.id === booking.id)
  assert.equal(received?.role, 'received')
})

test('book a model: ada can decline; you cannot book yourself', async () => {
  const app = await buildApp()
  const member = await login(app, 'member@vuekumi.demo')
  const ada = await login(app, 'ada@vuekumi.demo')

  const created = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { cookie: member },
    payload: {
      kind: 'model',
      handle: 'ada-molefe',
      title: 'Editorial lookbook, Johannesburg',
      brief: 'Half-day editorial shoot for a magazine feature; usage is editorial only.',
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const booking = (created.json() as { booking: { id: string } }).booking

  const declined = await app.inject({
    method: 'POST',
    url: `/api/bookings/${booking.id}/decline`,
    headers: { cookie: ada },
    payload: {},
  })
  assert.equal(declined.statusCode, 200, declined.body)
  assert.equal((declined.json() as { booking: { status: string } }).booking.status, 'declined')

  // Decided is final.
  const late = await app.inject({
    method: 'POST',
    url: `/api/bookings/${booking.id}/quote`,
    headers: { cookie: ada },
    payload: { quoteUsd: 300 },
  })
  assert.equal(late.statusCode, 400)

  const kofi = await login(app, 'kofi-mensah@vuekumi.demo')
  const self = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { cookie: kofi },
    payload: {
      kind: 'photographer',
      handle: 'kofi-mensah',
      title: 'Self booking',
      brief: 'This should be rejected because you cannot book yourself.',
    },
  })
  assert.equal(self.statusCode, 400)
})

test('availability: unavailable creators cannot receive new requests', async () => {
  const app = await buildApp()
  const thandiwe = await login(app, 'thandiwe-nkosi@vuekumi.demo')
  const member = await login(app, 'member@vuekumi.demo')

  const off = await app.inject({
    method: 'PATCH',
    url: '/api/auth/me',
    headers: { cookie: thandiwe },
    payload: { availability: 'unavailable', dayRateUsd: 450 },
  })
  assert.equal(off.statusCode, 200, off.body)
  assert.equal((off.json() as { user: { availability: string; dayRateUsd: number } }).user.availability, 'unavailable')

  const blocked = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { cookie: member },
    payload: {
      kind: 'photographer',
      handle: 'thandiwe-nkosi',
      title: 'Cape Town shoot',
      brief: 'A brief that should bounce because the photographer is unavailable.',
    },
  })
  assert.equal(blocked.statusCode, 400)
  assert.match((blocked.json() as { error: string }).error, /not taking bookings/)

  // Restore for other tests and check the public DTO carries availability.
  const on = await app.inject({
    method: 'PATCH',
    url: '/api/auth/me',
    headers: { cookie: thandiwe },
    payload: { availability: 'open', dayRateUsd: null },
  })
  assert.equal(on.statusCode, 200)

  const pub = await app.inject({ method: 'GET', url: '/api/photographers/thandiwe-nkosi' })
  const dto = (pub.json() as { photographer: { availability: string; dayRateUsd: number | null } }).photographer
  assert.equal(dto.availability, 'open')
  assert.equal(dto.dayRateUsd, null)
})
