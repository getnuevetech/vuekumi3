import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  allocateRevenue,
  defaultLibraryTier,
  deriveRightsStatus,
  openLibraryEligibility,
  OPEN_LICENSE_VERSION,
} from '@vuekumi/shared'

test('RevenuePolicy allocation stamps platform and creator pool without magic 50/50 in callers', () => {
  const allocation = allocateRevenue(100, {
    policyId: 'RP-2026-001',
    version: 1,
    platformShareRule: 0.5,
    creatorPoolRule: 0.5,
  })
  assert.equal(allocation.platformShareUsd, 50)
  assert.equal(allocation.creatorPoolUsd, 50)
  assert.equal(allocation.policyId, 'RP-2026-001')
  assert.equal(allocation.version, 1)

  const custom = allocateRevenue(100, {
    policyId: 'RP-TEST',
    version: 2,
    platformShareRule: 0.4,
    creatorPoolRule: 0.6,
  })
  assert.equal(custom.platformShareUsd, 40)
  assert.equal(custom.creatorPoolUsd, 60)
})

test('library tier defaults from license and permission state', () => {
  assert.equal(defaultLibraryTier({ licenseType: 'free' }), 'OPEN')
  assert.equal(defaultLibraryTier({ licenseType: 'premium' }), 'LICENSED')
  assert.equal(defaultLibraryTier({ licenseType: 'free', permissionState: 'editorial' }), 'EDITORIAL')
  assert.equal(defaultLibraryTier({ licenseType: 'free', permissionState: 'private' }), 'PRIVATE')
  assert.equal(defaultLibraryTier({ licenseType: 'free', permissionState: 'portfolio' }), 'PRIVATE')
})

test('rights status is separate from library tier and commercial status', () => {
  assert.equal(
    deriveRightsStatus({ copyrightStatus: 'verified', modelConsentStatus: 'approved', commercialEligible: true }),
    'VERIFIED',
  )
  assert.equal(
    deriveRightsStatus({ copyrightStatus: 'claimed', modelConsentStatus: 'pending' }),
    'PENDING',
  )
  assert.equal(
    deriveRightsStatus({ copyrightStatus: 'disputed', modelConsentStatus: 'approved' }),
    'DISPUTED',
  )
})

test('Open download requires OPEN tier, ENABLED commercial, and verified rights', () => {
  assert.equal(
    openLibraryEligibility({
      libraryTier: 'OPEN',
      commercialStatus: 'ENABLED',
      rightsStatus: 'VERIFIED',
    }).allowed,
    true,
  )
  assert.equal(
    openLibraryEligibility({
      libraryTier: 'LICENSED',
      commercialStatus: 'ENABLED',
      rightsStatus: 'VERIFIED',
    }).reason,
    'not_open_tier',
  )
  assert.equal(
    openLibraryEligibility({
      libraryTier: 'OPEN',
      commercialStatus: 'ENABLED',
      rightsStatus: 'VERIFIED',
      compensationRequested: true,
    }).reason,
    'compensation_requested',
  )
  assert.equal(
    openLibraryEligibility({
      libraryTier: 'OPEN',
      commercialStatus: 'ENABLED',
      rightsStatus: 'INCOMPLETE',
    }).reason,
    'rights_incomplete',
  )
  assert.ok(OPEN_LICENSE_VERSION.length > 0)
})
