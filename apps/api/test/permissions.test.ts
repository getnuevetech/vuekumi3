import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultPermissionState,
  permissionBlocksLicense,
  permissionPublicCopy,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { PhotoEditError } from '../src/lib/photo-edit.js'
import {
  assertPermissionStateChange,
  resolvePermissionState,
} from '../src/lib/permissions.js'
import { isLicenseOffered } from '../src/lib/rights.js'

const commercialProduct = {
  id: 'commercial',
  type: 'commercial' as const,
  name: 'Commercial',
  description: '',
  defaultUsd: 12,
  points: [],
  commercialAllowed: true,
  requiresModelRelease: true,
  agencyPreferred: false,
  quoteOnly: false,
  exclusiveOptIn: false,
  sortOrder: 2,
  active: true,
}

const editorialProduct = { ...commercialProduct, id: 'editorial', type: 'editorial' as const }
const rmProduct = {
  ...commercialProduct,
  id: 'rights_managed',
  type: 'rights_managed' as const,
  quoteOnly: true,
  requiresModelRelease: true,
}

const live = {
  licenseType: 'premium' as const,
  exclusiveAvailable: false,
  exclusiveSold: false,
  status: 'active' as const,
  commercialLocked: false,
  permissionState: 'commercial' as const,
  hasRecognizablePeople: false,
}

test('new people photographs default to editorial, exclusive opt-in stays exclusive', () => {
  assert.equal(defaultPermissionState({ hasRecognizablePeople: true }), 'editorial')
  assert.equal(defaultPermissionState({ hasRecognizablePeople: false }), 'commercial')
  assert.equal(
    defaultPermissionState({ exclusiveAvailable: true, hasRecognizablePeople: true }),
    'exclusive',
  )
})

test('permission states gate which licences are offered', () => {
  assert.equal(permissionBlocksLicense('private', 'editorial'), 'This photograph is private')
  assert.match(permissionBlocksLicense('portfolio', 'commercial') ?? '', /Portfolio-only/)
  assert.match(permissionBlocksLicense('agency_protected', 'commercial') ?? '', /Agency-protected/)
  assert.match(permissionBlocksLicense('editorial', 'commercial') ?? '', /Only editorial/)
  assert.equal(permissionBlocksLicense('editorial', 'editorial'), undefined)
  assert.match(permissionBlocksLicense('restricted', 'commercial') ?? '', /restricted/)
  assert.equal(permissionBlocksLicense('restricted', 'editorial'), undefined)
  assert.equal(permissionBlocksLicense('restricted', 'rights_managed'), undefined)
  assert.equal(permissionBlocksLicense('commercial', 'commercial'), undefined)
})

test('licence offer respects permission state and rights-managed still requires a model release', () => {
  assert.equal(isLicenseOffered(commercialProduct, { ...live, permissionState: 'portfolio' }).offered, false)
  assert.equal(isLicenseOffered(editorialProduct, { ...live, permissionState: 'editorial' }).offered, true)
  assert.equal(isLicenseOffered(commercialProduct, { ...live, permissionState: 'editorial' }).offered, false)
  assert.equal(isLicenseOffered(rmProduct, { ...live, permissionState: 'restricted' }).offered, true)
  assert.equal(rmProduct.requiresModelRelease, true)
})

test('people without two-party commercial clearance cannot move to commercial or exclusive', () => {
  assert.throws(
    () =>
      assertPermissionStateChange({
        next: 'commercial',
        current: 'editorial',
        exclusiveSold: false,
        commercialLocked: false,
        hasRecognizablePeople: true,
        twoPartyCleared: false,
        actor: 'contributor',
      }),
    PhotoEditError,
  )
  assert.doesNotThrow(() =>
    assertPermissionStateChange({
      next: 'editorial',
      current: 'portfolio',
      exclusiveSold: false,
      commercialLocked: false,
      hasRecognizablePeople: true,
      twoPartyCleared: false,
      actor: 'contributor',
    }),
  )
})

test('contributors cannot set or leave agency-protected; exclusive sold cannot leave exclusive', () => {
  assert.throws(
    () =>
      assertPermissionStateChange({
        next: 'agency_protected',
        exclusiveSold: false,
        commercialLocked: false,
        hasRecognizablePeople: false,
        twoPartyCleared: true,
        actor: 'contributor',
      }),
    /staff/,
  )
  assert.throws(
    () =>
      assertPermissionStateChange({
        next: 'commercial',
        current: 'exclusive',
        exclusiveSold: true,
        commercialLocked: false,
        hasRecognizablePeople: false,
        twoPartyCleared: true,
        actor: 'admin',
      }),
    /already been sold/,
  )
})

test('resolvePermissionState maps exclusive opt-in and requested states', () => {
  assert.equal(
    resolvePermissionState({ exclusiveAvailable: true, hasRecognizablePeople: false }),
    'exclusive',
  )
  assert.equal(
    resolvePermissionState({
      exclusiveAvailable: false,
      current: 'exclusive',
      hasRecognizablePeople: true,
    }),
    'editorial',
  )
  assert.equal(
    resolvePermissionState({ requested: 'portfolio', hasRecognizablePeople: false }),
    'portfolio',
  )
})

test('public copy explains non-stock states', () => {
  assert.match(permissionPublicCopy('portfolio') ?? '', /Portfolio only/)
  assert.match(permissionPublicCopy('restricted', 'No billboards') ?? '', /billboards/)
  assert.equal(permissionPublicCopy('commercial'), null)
})

test('catalog hides portfolio and private photographs; profiles still show portfolio', async () => {
  const app = await buildApp()
  const catalog = await app.inject({ method: 'GET', url: '/api/photos?q=Avenue+of+the+Baobabs' })
  if (catalog.statusCode !== 200) {
    await app.close()
    return
  }
  const catalogItems = (catalog.json() as { items: { id: string }[] }).items
  assert.equal(catalogItems.some((p) => p.id === 'afr-008'), false)

  const profile = await app.inject({ method: 'GET', url: '/api/photographers/thandiwe-nkosi' })
  assert.equal(profile.statusCode, 200)
  const profileItems = (profile.json() as { items: { id: string }[] }).items
  assert.equal(profileItems.some((p) => p.id === 'afr-008'), true)

  const privatePhoto = await app.inject({ method: 'GET', url: '/api/photos/afr-pend-1' })
  assert.equal(privatePhoto.statusCode, 404)

  const editorial = await app.inject({ method: 'GET', url: '/api/photos/afr-001' })
  assert.equal(editorial.statusCode, 200)
  assert.equal((editorial.json() as { permissionState?: string }).permissionState, 'editorial')

  const licenses = await app.inject({ method: 'GET', url: '/api/photos/afr-001/licenses' })
  const items = (licenses.json() as { items: { type: string; offered: boolean }[] }).items
  assert.equal(items.find((i) => i.type === 'editorial')?.offered, true)
  assert.equal(items.find((i) => i.type === 'commercial')?.offered, false)

  const exclusive = await app.inject({ method: 'GET', url: '/api/photos/afr-011' })
  assert.equal((exclusive.json() as { permissionState?: string }).permissionState, 'exclusive')
  await app.close()
})

test('contributor cannot commercially license people photos without two-party approval', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  if (login.statusCode !== 200) {
    await app.close()
    return
  }
  const raw = login.headers['set-cookie']
  const cookie = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')

  const blocked = await app.inject({
    method: 'PATCH',
    url: '/api/contributor/photos/afr-pend-1',
    headers: { cookie },
    payload: { permissionState: 'commercial' },
  })
  assert.equal(blocked.statusCode, 400)
  assert.match((blocked.json() as { error: string }).error, /Photo influencers cannot enter commercial inventory/)

  const privateOk = await app.inject({
    method: 'GET',
    url: '/api/contributor/photos/afr-pend-1',
    headers: { cookie },
  })
  assert.equal(privateOk.statusCode, 200)
  assert.equal((privateOk.json() as { photo: { permissionState?: string } }).photo.permissionState, 'private')
  await app.close()
})
