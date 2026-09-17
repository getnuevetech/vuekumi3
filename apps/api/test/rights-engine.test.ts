import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyScreeningToPeopleFlag,
  canEnterCommercialInventory,
  commercialEligibilityBlock,
  communityContributorBlocksState,
  copyrightCleared,
  identifyAppearanceSchema,
  isCommerciallyEligible,
  isCommunityContributor,
  isPhotographerAccount,
  likenessRightsCleared,
  outstandingConsentCount,
  registerSchema,
  rollupModelConsentStatus,
  screeningIndicatesPerson,
  twoPartyBlocksLicense,
} from '@vuekumi/shared'

test('photographers and community contributors are different account types', () => {
  assert.equal(isPhotographerAccount('photographer'), true)
  assert.equal(isPhotographerAccount('contributor'), false)
  assert.equal(isCommunityContributor('contributor'), true)
  assert.equal(canEnterCommercialInventory('photographer'), true)
  assert.equal(canEnterCommercialInventory('contributor'), false)
  assert.equal(canEnterCommercialInventory('admin'), true)
  assert.match(communityContributorBlocksState('commercial') ?? '', /professional photographer/)
  assert.equal(communityContributorBlocksState('portfolio'), undefined)
  assert.equal(registerSchema.safeParse({
    email: 'p@example.com',
    password: 'password1',
    name: 'Ada',
    accountType: 'photographer',
  }).success, true)
  assert.equal(registerSchema.safeParse({
    email: 'c@example.com',
    password: 'password1',
    name: 'Imani',
    accountType: 'contributor',
  }).success, true)
})

test('copyright and likeness are separate rights', () => {
  assert.equal(copyrightCleared('claimed'), true)
  assert.equal(copyrightCleared('verified'), true)
  assert.equal(copyrightCleared('disputed'), false)
  assert.equal(copyrightCleared('restricted'), false)
  assert.equal(likenessRightsCleared('not_required'), true)
  assert.equal(likenessRightsCleared('approved'), true)
  assert.equal(likenessRightsCleared('pending'), false)
  assert.equal(isCommerciallyEligible({
    copyrightStatus: 'claimed',
    modelConsentStatus: 'not_required',
  }), true)
  assert.equal(isCommerciallyEligible({
    copyrightStatus: 'claimed',
    modelConsentStatus: 'required',
  }), false)
  assert.equal(isCommerciallyEligible({
    copyrightStatus: 'disputed',
    modelConsentStatus: 'approved',
  }), false)
})

test('multi-model lock counts outstanding consents and does not treat a PDF as clearance', () => {
  const appearances = [
    { status: 'approved' as const, usage: 'commercial' as const, confirmedLikeness: true, consentStatus: 'approved' as const },
    { status: 'approved' as const, usage: 'commercial' as const, confirmedLikeness: true, consentStatus: 'approved' as const },
    { status: 'invited' as const, usage: 'none' as const, confirmedLikeness: false, consentStatus: 'invitation_sent' as const },
    { status: 'approved' as const, usage: 'commercial' as const, confirmedLikeness: true, consentStatus: 'approved' as const },
  ]
  assert.equal(rollupModelConsentStatus({ hasRecognizablePeople: true, appearances }), 'invitation_sent')
  assert.equal(outstandingConsentCount(appearances), 1)
  assert.match(
    twoPartyBlocksLicense({
      hasRecognizablePeople: true,
      appearances,
      licenseType: 'commercial',
      requiresModelRelease: true,
    }) ?? '',
    /LOCKED — 1 required consent outstanding/,
  )
  assert.match(
    commercialEligibilityBlock({
      copyrightStatus: 'claimed',
      modelConsentStatus: 'required',
      appearances: [],
    }) ?? '',
    /Likeness \/ model release rights are not cleared/,
  )
})

test('minors stay outstanding without guardian authorization', () => {
  assert.equal(
    outstandingConsentCount([{
      status: 'approved',
      usage: 'commercial',
      confirmedLikeness: true,
      consentStatus: 'approved',
      isMinor: true,
      guardianAuthorizedAt: null,
    }]),
    1,
  )
})

test('AI screening detects people, not copyright, and never uses biometrics', () => {
  assert.equal(screeningIndicatesPerson('no_recognizable_person'), false)
  assert.equal(screeningIndicatesPerson('one_recognizable_person'), true)
  assert.equal(screeningIndicatesPerson('uncertain_human_detection'), true)
  assert.equal(applyScreeningToPeopleFlag({
    declaredPeople: false,
    screening: { kind: 'one_recognizable_person', uncertainHumanDetection: false },
  }), true)
  assert.equal(applyScreeningToPeopleFlag({
    declaredPeople: false,
    screening: { kind: 'no_recognizable_person', uncertainHumanDetection: false },
  }), false)
})

test('Route B identification requires a private mobile number', () => {
  assert.equal(identifyAppearanceSchema.safeParse({
    displayName: 'Ada',
    email: 'ada@example.com',
  }).success, false)
  assert.equal(identifyAppearanceSchema.safeParse({
    displayName: 'Ada',
    email: 'ada@example.com',
    mobile: '+26771111111',
  }).success, true)
  assert.equal(identifyAppearanceSchema.safeParse({
    displayName: 'Child',
    email: 'guardian@example.com',
    mobile: '+26771111111',
    ageClass: 'minor',
    isMinor: true,
  }).success, false)
  assert.equal(identifyAppearanceSchema.safeParse({
    displayName: 'Child',
    email: 'parent@example.com',
    mobile: '+26771111111',
    ageClass: 'minor',
    isMinor: true,
    guardianName: 'Parent',
    guardianEmail: 'parent@example.com',
    guardianMobile: '+26772222222',
  }).success, true)
})
