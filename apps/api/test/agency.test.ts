import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canChangeRole,
  canManageTeam,
  canPurchase,
  canQuote,
  canRemoveMember,
  inviteAccountBlocked,
  roleAtLeast,
  seatsRemaining,
} from '../src/lib/agency.js'

test('role rank: owner outranks viewer', () => {
  assert.equal(roleAtLeast('owner', 'viewer'), true)
  assert.equal(roleAtLeast('viewer', 'member'), false)
  assert.equal(roleAtLeast('manager', 'manager'), true)
})

test('team management is owner/admin only', () => {
  assert.equal(canManageTeam('owner'), true)
  assert.equal(canManageTeam('admin'), true)
  assert.equal(canManageTeam('manager'), false)
  assert.equal(canManageTeam('member'), false)
})

test('purchase is member and above; quotes are manager and above', () => {
  assert.equal(canPurchase('viewer'), false)
  assert.equal(canPurchase('member'), true)
  assert.equal(canQuote('member'), false)
  assert.equal(canQuote('manager'), true)
  assert.equal(canQuote('owner'), true)
})

test('seat remaining counts members plus pending invites', () => {
  assert.equal(seatsRemaining({ seatLimit: 20, memberCount: 2, pendingInviteCount: 1 }), 17)
  assert.equal(seatsRemaining({ seatLimit: 2, memberCount: 2, pendingInviteCount: 0 }), 0)
  assert.equal(seatsRemaining({ seatLimit: 2, memberCount: 1, pendingInviteCount: 1 }), 0)
})

test('contributors and admins cannot join an agency', () => {
  assert.equal(inviteAccountBlocked('contributor'), 'Contributors cannot join an agency')
  assert.equal(inviteAccountBlocked('admin'), 'Administrators cannot join an agency')
  assert.equal(inviteAccountBlocked('user'), null)
  assert.equal(inviteAccountBlocked('agency'), null)
  assert.equal(inviteAccountBlocked(undefined), null)
})

test('role changes never touch owner and admins cannot promote to admin', () => {
  assert.equal(canChangeRole('owner', 'member', 'admin'), true)
  assert.equal(canChangeRole('owner', 'owner', 'admin'), false)
  assert.equal(canChangeRole('admin', 'member', 'manager'), true)
  assert.equal(canChangeRole('admin', 'member', 'admin'), false)
  assert.equal(canChangeRole('admin', 'admin', 'member'), false)
  assert.equal(canChangeRole('manager', 'member', 'viewer'), false)
})

test('owner cannot be removed; members may leave; admin cannot remove admin', () => {
  assert.equal(canRemoveMember('owner', 'owner', false), false)
  assert.equal(canRemoveMember('owner', 'admin', false), true)
  assert.equal(canRemoveMember('admin', 'admin', false), false)
  assert.equal(canRemoveMember('admin', 'member', false), true)
  assert.equal(canRemoveMember('member', 'member', true), true)
  assert.equal(canRemoveMember('member', 'viewer', false), false)
})
