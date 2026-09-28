import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  allocateRevenue,
  defaultLibraryTier,
  deriveRightsStatus,
  openLibraryEligibility,
  verifiedPlusEligibility,
  resolveUploadLibraryTier,
  allowedUploadLibraryTiers,
  FREE_LIBRARY_TIER,
  FREE_LIBRARY_LABEL,
  LIBRARY_TIER_LABEL,
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

test('Verified+ requires Rights Verified + commercial enabled; not private inventory', () => {
  assert.equal(
    verifiedPlusEligibility({
      commercialStatus: 'ENABLED',
      rightsStatus: 'VERIFIED',
    }).allowed,
    true,
  )
  assert.equal(
    verifiedPlusEligibility({
      commercialStatus: 'ENABLED',
      rightsStatus: 'PENDING',
    }).reason,
    'rights_not_verified',
  )
  assert.equal(
    verifiedPlusEligibility({
      commercialStatus: 'BLOCKED',
      rightsStatus: 'VERIFIED',
    }).reason,
    'commercial_blocked',
  )
  assert.equal(
    verifiedPlusEligibility({
      commercialStatus: 'ENABLED',
      rightsStatus: 'VERIFIED',
      commercialLocked: true,
    }).reason,
    'commercial_blocked',
  )
  assert.equal(
    verifiedPlusEligibility({
      commercialStatus: 'ENABLED',
      rightsStatus: 'VERIFIED',
      permissionState: 'private',
    }).reason,
    'private_inventory',
  )
  assert.equal(
    verifiedPlusEligibility({
      commercialStatus: 'ENABLED',
      rightsStatus: 'VERIFIED',
      permissionState: 'portfolio',
    }).reason,
    'private_inventory',
  )
})

test('Dec-TierMap: Photo Influencer Free Library only; photographer/contributor paid tiers', () => {
  assert.equal(FREE_LIBRARY_TIER, 'OPEN')
  assert.equal(LIBRARY_TIER_LABEL.OPEN, FREE_LIBRARY_LABEL)
  assert.deepEqual(allowedUploadLibraryTiers('photo_influencer'), ['OPEN'])
  assert.ok(allowedUploadLibraryTiers('photographer').includes('LICENSED'))
  assert.ok(!allowedUploadLibraryTiers('photographer').includes('OPEN'))
  assert.ok(allowedUploadLibraryTiers('contributor').includes('LICENSED'))
  assert.ok(!allowedUploadLibraryTiers('contributor').includes('OPEN'))

  assert.equal(
    resolveUploadLibraryTier({ accountType: 'photo_influencer', licenseType: 'free' }).tier,
    'OPEN',
  )
  assert.equal(
    resolveUploadLibraryTier({
      accountType: 'photo_influencer',
      licenseType: 'premium',
      requestedTier: 'LICENSED',
    }).error?.includes('Free Library'),
    true,
  )
  assert.equal(
    resolveUploadLibraryTier({ accountType: 'photographer', licenseType: 'free' }).tier,
    'LICENSED',
  )
  assert.equal(
    resolveUploadLibraryTier({
      accountType: 'contributor',
      licenseType: 'premium',
      requestedTier: 'OPEN',
    }).error?.includes('paid library'),
    true,
  )
})
