import assert from 'node:assert/strict'
import { test } from 'node:test'
import { approvalRate, followBlocked } from '../src/lib/follows.js'

test('cannot follow a missing, non-contributor, or inactive photographer', () => {
  assert.deepEqual(
    followBlocked({ followerId: 'me', photographer: null }),
    { status: 404, error: 'Photographer not found' },
  )
  assert.deepEqual(
    followBlocked({
      followerId: 'me',
      photographer: { id: 'them', accountType: 'user', status: 'active' },
    }),
    { status: 404, error: 'Photographer not found' },
  )
  assert.deepEqual(
    followBlocked({
      followerId: 'me',
      photographer: { id: 'them', accountType: 'contributor', status: 'suspended' },
    }),
    { status: 404, error: 'Photographer not found' },
  )
})

test('a contributor cannot follow themselves', () => {
  assert.deepEqual(
    followBlocked({
      followerId: 'amara',
      photographer: { id: 'amara', accountType: 'contributor', status: 'active' },
    }),
    { status: 400, error: 'You cannot follow yourself' },
  )
})

test('members and other contributors can follow an active photographer', () => {
  assert.equal(
    followBlocked({
      followerId: 'member',
      photographer: { id: 'amara', accountType: 'contributor', status: 'active' },
    }),
    null,
  )
})

test('approval rate uses decided photos only', () => {
  assert.equal(approvalRate(0, 0), 0)
  assert.equal(approvalRate(94, 6), 94)
  assert.equal(approvalRate(1, 1), 50)
  assert.equal(approvalRate(3, 0), 100)
})
