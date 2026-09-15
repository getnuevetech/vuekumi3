import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import {
  PhotoEditError,
  assertContributorStatusChange,
  assertExclusiveEdit,
  assertPeopleFlagEdit,
  nextLicensePrice,
  nextModelReleaseFields,
} from '../src/lib/photo-edit.js'

test('contributor photo update requires a session', async () => {
  const app = await buildApp()
  const get = await app.inject({ method: 'GET', url: '/api/contributor/photos/afr-011' })
  const patch = await app.inject({
    method: 'PATCH',
    url: '/api/contributor/photos/afr-011',
    payload: { title: 'Hijack' },
  })
  assert.equal(get.statusCode, 401)
  assert.equal(patch.statusCode, 401)
  await app.close()
})

test('unpublish is only for live or pending work, and never after exclusive sale', () => {
  assert.doesNotThrow(() =>
    assertContributorStatusChange({ current: 'active', next: 'delisted', exclusiveSold: false }),
  )
  assert.doesNotThrow(() =>
    assertContributorStatusChange({ current: 'pending', next: 'delisted', exclusiveSold: false }),
  )
  assert.throws(
    () => assertContributorStatusChange({ current: 'active', next: 'delisted', exclusiveSold: true }),
    PhotoEditError,
  )
  assert.throws(
    () => assertContributorStatusChange({ current: 'rejected', next: 'delisted', exclusiveSold: false }),
    /Only live or pending/,
  )
})

test('resubmit is for unpublished, draft, or rejected work', () => {
  assert.doesNotThrow(() =>
    assertContributorStatusChange({ current: 'delisted', next: 'pending', exclusiveSold: false }),
  )
  assert.doesNotThrow(() =>
    assertContributorStatusChange({ current: 'rejected', next: 'pending', exclusiveSold: false }),
  )
  assert.throws(
    () => assertContributorStatusChange({ current: 'active', next: 'pending', exclusiveSold: false }),
    /unpublished, draft, or rejected/,
  )
})

test('premium keeps a price; free collection is $0', () => {
  assert.equal(nextLicensePrice({ licenseType: 'free', currentPrice: 12 }), 0)
  assert.equal(nextLicensePrice({ licenseType: 'premium', currentPrice: 18 }), 18)
  assert.equal(nextLicensePrice({ licenseType: 'premium', price: 24, currentPrice: 12 }), 24)
  assert.equal(nextLicensePrice({ licenseType: 'premium', currentPrice: 0 }), 12)
})

test('declaring people pending a release does not wipe a verified one', () => {
  assert.deepEqual(nextModelReleaseFields({ hasRecognizablePeople: true, current: 'verified' }), {
    modelReleaseRequired: true,
    modelReleaseStatus: 'verified',
  })
  assert.deepEqual(nextModelReleaseFields({ hasRecognizablePeople: true, current: 'not_required' }), {
    modelReleaseRequired: true,
    modelReleaseStatus: 'pending',
  })
  assert.deepEqual(nextModelReleaseFields({ hasRecognizablePeople: false, current: 'pending' }), {
    modelReleaseRequired: false,
    modelReleaseStatus: 'not_required',
  })
})

test('contributors cannot clear a people/model-release flag themselves', () => {
  assert.doesNotThrow(() => assertPeopleFlagEdit({ requested: true, currentlyRequired: false }))
  assert.throws(
    () => assertPeopleFlagEdit({ requested: false, currentlyRequired: true }),
    /Ask an admin/,
  )
})

test('exclusive opt-out is blocked after an exclusive grant', () => {
  assert.doesNotThrow(() => assertExclusiveEdit({ exclusiveSold: false, exclusiveAvailable: false }))
  assert.throws(
    () => assertExclusiveEdit({ exclusiveSold: true, exclusiveAvailable: false }),
    /cannot be turned off/,
  )
})
