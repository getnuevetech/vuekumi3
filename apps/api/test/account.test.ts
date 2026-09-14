import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isCurrentRefreshToken,
  normalizeHandle,
  passwordChangeBlocked,
  summarizeUserAgent,
} from '../src/lib/account.js'

test('handles are slugged, length-checked, and reserved names are blocked', () => {
  assert.deepEqual(normalizeHandle('  Amara Okafor  '), { handle: 'amaraokafor' })
  assert.deepEqual(normalizeHandle('amara-okafor'), { handle: 'amara-okafor' })
  assert.equal('error' in normalizeHandle('ab'), true)
  assert.equal('error' in normalizeHandle('login'), true)
  assert.equal('error' in normalizeHandle('account'), true)
  assert.equal('error' in normalizeHandle('admin'), true)
})

test('password change requires the current password when one is already set', () => {
  assert.deepEqual(
    passwordChangeBlocked({ hasPassword: true }),
    { status: 400, error: 'Current password is required' },
  )
  assert.equal(passwordChangeBlocked({ hasPassword: true, currentPassword: 'secret' }), null)
  assert.equal(passwordChangeBlocked({ hasPassword: false }), null)
})

test('user-agent summary names browser and OS', () => {
  assert.equal(summarizeUserAgent(null), 'Unknown device')
  assert.equal(
    summarizeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0'),
    'Chrome on macOS',
  )
  assert.equal(
    summarizeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'),
    'Firefox on Windows',
  )
  assert.match(summarizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1'), /Safari on iOS/)
})

test('current session is identified by the hashed refresh cookie', () => {
  const hash = (raw: string) => `h:${raw}`
  assert.equal(isCurrentRefreshToken('abc', 'h:abc', hash), true)
  assert.equal(isCurrentRefreshToken('abc', 'h:other', hash), false)
  assert.equal(isCurrentRefreshToken(undefined, 'h:abc', hash), false)
})
