import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { test } from 'node:test'

process.env.STORAGE_DRIVER = 'local'
process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), 'vuekumi-storage-'))
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production'

const {
  assertOwnedOriginalKey,
  extensionFor,
  getObjectBuffer,
  originalKeyFor,
  presignPut,
  verifyLocalToken,
  writeLocalUpload,
} = await import('../src/lib/storage.js')

test('extension and owned key helpers', () => {
  assert.equal(extensionFor('shot.JPEG', 'image/jpeg'), 'jpg')
  assert.equal(extensionFor('shot.png', 'image/png'), 'png')
  const key = originalKeyFor('user-1', 'jpg')
  assert.match(key, /^originals\/user-1\/\d{4}\/.+\.jpg$/)
  assert.doesNotThrow(() => assertOwnedOriginalKey(key, 'user-1'))
  assert.throws(() => assertOwnedOriginalKey(key, 'other-user'))
  assert.throws(() => assertOwnedOriginalKey('originals/user-1/../secret', 'user-1'))
})

test('local presign token round-trips', async () => {
  const signed = await presignPut('originals/user-1/2026/abc.jpg', 'image/jpeg')
  assert.equal(signed.driver, 'local')
  assert.equal(signed.method, 'PUT')
  const token = signed.uploadUrl.split('/').pop()!
  assert.equal(verifyLocalToken(token), 'originals/user-1/2026/abc.jpg')
  assert.equal(verifyLocalToken('not-a-token'), null)
})

test('local put and get', async () => {
  const key = 'originals/user-1/2026/test-bin.jpg'
  const body = Buffer.from('hello-image')
  await writeLocalUpload(key, Readable.from(body))
  const read = await getObjectBuffer(key)
  assert.equal(read.toString(), 'hello-image')
  await rm(process.env.STORAGE_DIR!, { recursive: true, force: true })
})
