import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_FROM_ADDRESS,
  htmlToText,
  postResendEmail,
  resendKeyReady,
  sendEmail,
  verifyEmail,
} from '../src/lib/email.js'

test('Resend keys must start with re_ and have a body', () => {
  assert.equal(resendKeyReady(null), false)
  assert.equal(resendKeyReady(''), false)
  assert.equal(resendKeyReady('re_short'), false)
  assert.equal(resendKeyReady('sk_live_not_resend'), false)
  assert.equal(resendKeyReady('re_test_abcdefghijklmnopqrstuvwxyz'), true)
})

test('htmlToText keeps links and strips tags', () => {
  const text = htmlToText('<p>Hi Adaeze,</p><p><a href="https://vuekumi.com/verify">click</a></p>')
  assert.match(text, /Hi Adaeze/)
  assert.match(text, /https:\/\/vuekumi.com\/verify/)
  assert.equal(text.includes('<p>'), false)
})

test('postResendEmail posts HTML and text to Resend', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify({ id: 'msg_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const result = await postResendEmail(
    're_test_abcdefghijklmnopqrstuvwxyz',
    {
      from: DEFAULT_FROM_ADDRESS,
      to: 'adaeze@example.com',
      subject: 'Verify your Vuekumi email',
      html: verifyEmail('Adaeze', 'https://vuekumi.com/verify-email/tok'),
      text: 'plain',
    },
    fetchImpl,
  )
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.id, 'msg_123')
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, 'https://api.resend.com/emails')
  const headers = new Headers(calls[0]?.init.headers)
  assert.equal(headers.get('Authorization'), 'Bearer re_test_abcdefghijklmnopqrstuvwxyz')
  const body = JSON.parse(String(calls[0]?.init.body)) as { from: string; to: string[]; html: string; text: string }
  assert.equal(body.from, DEFAULT_FROM_ADDRESS)
  assert.deepEqual(body.to, ['adaeze@example.com'])
  assert.match(body.html, /Adaeze/)
  assert.equal(body.text, 'plain')
})

test('sendEmail skips when Resend is not configured', async () => {
  const result = await sendEmail(
    { to: 'a@b.com', subject: 'x', html: '<p>hi</p>' },
    { apiKey: null },
  )
  assert.deepEqual(result, { status: 'skipped', reason: 'not_configured' })
})

test('sendEmail delivers through Resend when a key is set', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ id: 'msg_ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const result = await sendEmail(
    { to: 'a@b.com', subject: 'Verify your Vuekumi email', html: '<p>hi</p>' },
    { apiKey: 're_test_abcdefghijklmnopqrstuvwxyz', from: 'Vuekumi <hello@vuekumi.com>', fetchImpl },
  )
  assert.deepEqual(result, { status: 'sent', id: 'msg_ok' })
})

test('sendEmail does not throw when Resend returns an error', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ message: 'Invalid from address' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    })
  const result = await sendEmail(
    { to: 'a@b.com', subject: 'x', html: '<p>hi</p>' },
    { apiKey: 're_test_abcdefghijklmnopqrstuvwxyz', fetchImpl },
  )
  assert.equal(result.status, 'failed')
  if (result.status === 'failed') assert.match(result.error, /Invalid from address/)
})
