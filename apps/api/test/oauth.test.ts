import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildGoogleAuthorizeUrl,
  decideOAuthIdentity,
  safeOAuthRedirect,
} from '../src/lib/oauth.js'

test('Google authorize URL includes client, callback, state, and email scope', () => {
  const url = buildGoogleAuthorizeUrl({
    clientId: 'client-123.apps.googleusercontent.com',
    redirectUri: 'http://localhost:3000/api/auth/oauth/google/callback',
    state: 'abc123',
  })
  const parsed = new URL(url)
  assert.equal(parsed.origin, 'https://accounts.google.com')
  assert.equal(parsed.searchParams.get('client_id'), 'client-123.apps.googleusercontent.com')
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/oauth/google/callback')
  assert.equal(parsed.searchParams.get('state'), 'abc123')
  assert.equal(parsed.searchParams.get('response_type'), 'code')
  assert.match(parsed.searchParams.get('scope') ?? '', /email/)
})

test('OAuth redirect stays on-site', () => {
  assert.equal(safeOAuthRedirect('/agency'), '/agency')
  assert.equal(safeOAuthRedirect('/licenses?tab=1'), '/licenses?tab=1')
  assert.equal(safeOAuthRedirect('https://evil.example/phish'), '/')
  assert.equal(safeOAuthRedirect('//evil.example'), '/')
  assert.equal(safeOAuthRedirect('../outside'), '/')
  assert.equal(safeOAuthRedirect(undefined), '/')
})

test('existing OAuth link reuses the user', () => {
  assert.deepEqual(
    decideOAuthIdentity({
      linkedUser: { id: 'u1', status: 'active' },
      emailUser: { id: 'u2', status: 'active' },
    }),
    { action: 'reuse', userId: 'u1' },
  )
})

test('matching email links the Google account without changing type', () => {
  assert.deepEqual(
    decideOAuthIdentity({
      linkedUser: null,
      emailUser: { id: 'u9', status: 'active' },
    }),
    { action: 'link', userId: 'u9' },
  )
})

test('unknown email creates a member account', () => {
  assert.deepEqual(
    decideOAuthIdentity({ linkedUser: null, emailUser: null }),
    { action: 'create' },
  )
})

test('suspended users are refused for both link and reuse', () => {
  assert.deepEqual(
    decideOAuthIdentity({
      linkedUser: { id: 'u1', status: 'suspended' },
      emailUser: null,
    }),
    { action: 'reject', error: 'suspended', userId: 'u1' },
  )
  assert.deepEqual(
    decideOAuthIdentity({
      linkedUser: null,
      emailUser: { id: 'u2', status: 'suspended' },
    }),
    { action: 'reject', error: 'suspended', userId: 'u2' },
  )
})
