import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quotePricedEmail, quoteRequestOpsEmail } from '../src/lib/email.js'
import { parseQuoteStatus, sortQuotesForQueue } from '../src/lib/quotes.js'

test('parseQuoteStatus only accepts queue statuses', () => {
  assert.equal(parseQuoteStatus('pending'), 'pending')
  assert.equal(parseQuoteStatus('quoted'), 'quoted')
  assert.equal(parseQuoteStatus('accepted'), 'accepted')
  assert.equal(parseQuoteStatus('declined'), 'declined')
  assert.equal(parseQuoteStatus('nope'), undefined)
  assert.equal(parseQuoteStatus(undefined), undefined)
})

test('queue sorts pending first, then newest within a status', () => {
  const sorted = sortQuotesForQueue([
    { status: 'accepted', createdAt: '2026-09-15T10:00:00.000Z' },
    { status: 'pending', createdAt: '2026-09-14T10:00:00.000Z' },
    { status: 'pending', createdAt: '2026-09-15T12:00:00.000Z' },
    { status: 'quoted', createdAt: '2026-09-15T11:00:00.000Z' },
  ])
  assert.deepEqual(sorted.map((q) => `${q.status}:${q.createdAt.slice(8, 10)}`), [
    'pending:15',
    'pending:14',
    'quoted:15',
    'accepted:15',
  ])
})

test('quote request email points ops at the admin queue', () => {
  const html = quoteRequestOpsEmail({
    photoTitle: 'Sahara Caravan',
    requesterEmail: 'agency@vuekumi.demo',
    territory: 'West Africa',
    duration: '12 months',
    channels: 'OOH + social',
    notes: 'Lagos campaign',
    queueUrl: 'http://localhost:3000/admin/quotes',
  })
  assert.match(html, /Sahara Caravan/)
  assert.match(html, /agency@vuekumi.demo/)
  assert.match(html, /West Africa/)
  assert.match(html, /Lagos campaign/)
  assert.match(html, /\/admin\/quotes/)
  assert.match(html, /usage permission/)
})

test('priced quote email names the USD amount and licences page', () => {
  const html = quotePricedEmail({
    name: 'Kemi',
    photoTitle: 'Sahara Caravan',
    amountUsd: 450,
    licensesUrl: 'http://localhost:3000/licenses',
  })
  assert.match(html, /Hi Kemi/)
  assert.match(html, /Sahara Caravan/)
  assert.match(html, /450.00/)
  assert.match(html, /\/licenses/)
})
