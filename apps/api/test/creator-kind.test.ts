import assert from 'node:assert/strict'
import { test } from 'node:test'
import { creatorKindFromAccountType, creatorKindLabel } from '@vuekumi/shared'
import {
  creatorKindChange,
  creatorKindWhere,
  mixedCreatorKindBlocked,
  registrationCreatorKind,
} from '../src/lib/creator-kind.js'

test('creator kind is locked to account type', () => {
  assert.equal(registrationCreatorKind('photographer'), 'photographer')
  assert.equal(registrationCreatorKind('photographer', 'photo_influencer'), 'photographer')
  assert.equal(registrationCreatorKind('photo_influencer'), 'photo_influencer')
  assert.equal(registrationCreatorKind('photo_influencer', 'photographer'), 'photo_influencer')
  assert.equal(registrationCreatorKind('contributor'), 'photographer')
  assert.equal(creatorKindFromAccountType('photographer'), 'photographer')
  assert.equal(creatorKindFromAccountType('photo_influencer'), 'photo_influencer')
  assert.equal(creatorKindFromAccountType('contributor'), null)
})

test('community contributors cannot register as photo influencers', () => {
  assert.match(mixedCreatorKindBlocked('contributor', 'photo_influencer') ?? '', /separate/)
})

test('photographer and photo influencer kinds cannot be mixed', () => {
  assert.match(mixedCreatorKindBlocked('photographer', 'photo_influencer') ?? '', /separate/)
  assert.match(mixedCreatorKindBlocked('photo_influencer', 'photographer') ?? '', /separate/)
  assert.equal(mixedCreatorKindBlocked('photographer', 'photographer'), null)
  assert.equal(mixedCreatorKindBlocked('photo_influencer', 'photo_influencer'), null)
})

test('non-creator accounts never carry a creator kind', () => {
  assert.equal(registrationCreatorKind('user'), null)
  assert.equal(registrationCreatorKind('agency', 'photo_influencer'), null)
  assert.equal(registrationCreatorKind('model', 'photographer'), null)
})

test('profile update cannot switch photographer and photo influencer', () => {
  assert.equal(creatorKindChange(true, 'photo_influencer'), null)
  assert.equal(creatorKindChange(true, 'photographer'), null)
  assert.equal(creatorKindChange(true, undefined), null)
  assert.equal(creatorKindChange(false, 'photo_influencer'), null)
})

test('directory filter uses account type, not a nested kind', () => {
  assert.deepEqual(creatorKindWhere(undefined), {
    accountType: { in: ['photographer', 'photo_influencer'] },
  })
  assert.deepEqual(creatorKindWhere('photo_influencer'), {
    accountType: 'photo_influencer',
  })
  assert.deepEqual(creatorKindWhere('photographer'), {
    accountType: 'photographer',
  })
})

test('labels are honest and default to photographer', () => {
  assert.equal(creatorKindLabel('photographer'), 'Photographer')
  assert.equal(creatorKindLabel('photo_influencer'), 'Photo influencer')
  assert.equal(creatorKindLabel(null), 'Photographer')
  assert.equal(creatorKindLabel(undefined), 'Photographer')
})
