import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canEditCollection,
  canViewCollection,
  MAX_COLLECTION_PHOTOS,
  MAX_COLLECTIONS,
} from '../src/lib/collections.js'

const privateBox = {
  visibility: 'private',
  ownerId: 'member-1',
  agencyId: null as string | null,
  shareToken: 'tok-private',
}

const unlistedBox = {
  visibility: 'unlisted',
  ownerId: 'member-1',
  agencyId: null as string | null,
  shareToken: 'tok-share',
}

const agencyBox = {
  visibility: 'private',
  ownerId: 'agency-owner',
  agencyId: 'agency-1',
  shareToken: 'tok-agency',
}

test('private collections are owner-only without a share token', () => {
  assert.equal(canViewCollection(privateBox, { id: 'member-1' }), true)
  assert.equal(canViewCollection(privateBox, { id: 'stranger' }), false)
  assert.equal(canViewCollection(privateBox, null, 'tok-private'), false)
  assert.equal(canViewCollection(privateBox, null), false)
})

test('unlisted collections open with the share token', () => {
  assert.equal(canViewCollection(unlistedBox, null, 'tok-share'), true)
  assert.equal(canViewCollection(unlistedBox, null, 'wrong'), false)
  assert.equal(canViewCollection(unlistedBox, { id: 'stranger' }), false)
  assert.equal(canViewCollection({ ...unlistedBox, visibility: 'public' }, null), true)
})

test('agency members can view a shared lightbox', () => {
  assert.equal(canViewCollection(agencyBox, { id: 'kemi', agencyId: 'agency-1', agencyRole: 'manager' }), true)
  assert.equal(canViewCollection(agencyBox, { id: 'kemi', agencyId: 'other', agencyRole: 'owner' }), false)
})

test('edit rights: owner always; agency member and above; not viewer', () => {
  assert.equal(canEditCollection(agencyBox, { id: 'agency-owner', agencyId: 'agency-1', agencyRole: 'owner' }), true)
  assert.equal(canEditCollection(agencyBox, { id: 'kemi', agencyId: 'agency-1', agencyRole: 'manager' }), true)
  assert.equal(canEditCollection(agencyBox, { id: 'kemi', agencyId: 'agency-1', agencyRole: 'member' }), true)
  assert.equal(canEditCollection(agencyBox, { id: 'kemi', agencyId: 'agency-1', agencyRole: 'viewer' }), false)
  assert.equal(canEditCollection(privateBox, { id: 'stranger' }), false)
})

test('collection caps stay at 50 lists and 200 photographs', () => {
  assert.equal(MAX_COLLECTIONS, 50)
  assert.equal(MAX_COLLECTION_PHOTOS, 200)
})
