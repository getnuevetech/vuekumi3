import assert from 'node:assert/strict'
import { test } from 'node:test'
import { creatorKindLabel } from '@vuekumi/shared'
import {
  creatorKindChange,
  creatorKindWhere,
  registrationCreatorKind,
} from '../src/lib/creator-kind.js'

test('contributor registration defaults to photographer', () => {
  assert.equal(registrationCreatorKind('contributor'), 'photographer')
  assert.equal(registrationCreatorKind('contributor', 'photographer'), 'photographer')
})

test('a contributor can register as a photo influencer', () => {
  assert.equal(registrationCreatorKind('contributor', 'photo_influencer'), 'photo_influencer')
})

test('photographer registration also carries a creator kind', () => {
  assert.equal(registrationCreatorKind('photographer'), 'photographer')
  assert.equal(registrationCreatorKind('photographer', 'photo_influencer'), 'photo_influencer')
})

test('non-creator accounts never carry a creator kind', () => {
  assert.equal(registrationCreatorKind('user'), null)
  assert.equal(registrationCreatorKind('agency', 'photo_influencer'), null)
  assert.equal(registrationCreatorKind('model', 'photographer'), null)
})

test('profile update changes the kind only on contributor profiles', () => {
  assert.equal(creatorKindChange(true, 'photo_influencer'), 'photo_influencer')
  assert.equal(creatorKindChange(true, 'photographer'), 'photographer')
  assert.equal(creatorKindChange(true, undefined), null)
  assert.equal(creatorKindChange(false, 'photo_influencer'), null)
})

test('directory filter is a no-op without a kind', () => {
  assert.deepEqual(creatorKindWhere(undefined), {})
  assert.deepEqual(creatorKindWhere('photo_influencer'), {
    contributorProfile: { creatorKind: 'photo_influencer' },
  })
  assert.deepEqual(creatorKindWhere('photographer'), {
    contributorProfile: { creatorKind: 'photographer' },
  })
})

test('labels are honest and default to photographer', () => {
  assert.equal(creatorKindLabel('photographer'), 'Photographer')
  assert.equal(creatorKindLabel('photo_influencer'), 'Photo influencer')
  assert.equal(creatorKindLabel(null), 'Photographer')
  assert.equal(creatorKindLabel(undefined), 'Photographer')
})
