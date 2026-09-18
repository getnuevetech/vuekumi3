import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { approvedLikenessWhere, modelPortfolioPhotoWhere } from '../src/lib/catalog.js'

test('model portfolios include approved likeness photographs and display-allowed model uploads', () => {
  const where = modelPortfolioPhotoWhere('model-user')
  assert.equal(where.status, 'active')
  assert.ok(where.permissionState)
  assert.deepEqual(where.OR, [
    { appearances: { some: approvedLikenessWhere('model-user') } },
    { uploadedById: 'model-user' },
  ])
  const appearance = approvedLikenessWhere('model-user')
  assert.equal(appearance.status, 'approved')
  assert.equal(appearance.confirmedLikeness, true)
})

test('public model list and Ada / Kofi portfolios hide emails and keep photographer copyright', async () => {
  const app = await buildApp()

  const list = await app.inject({ method: 'GET', url: '/api/models' })
  assert.equal(list.statusCode, 200)
  const listed = list.json() as {
    items: {
      handle: string
      name: string
      earns: boolean
      photographerHandle: string | null
      photosCount: number
    }[]
  }
  const body = JSON.stringify(listed)
  assert.equal(body.includes('@vuekumi.demo'), false)

  const adaCard = listed.items.find((row) => row.handle === 'ada-molefe')
  const kofiCard = listed.items.find((row) => row.handle === 'kofi-mensah')
  assert.ok(adaCard, 'Ada is listed')
  assert.ok(kofiCard, 'Kofi is listed')
  assert.equal(adaCard?.earns, false)
  assert.equal(adaCard?.photographerHandle, null)
  assert.equal(kofiCard?.photographerHandle, 'kofi-mensah')
  assert.equal(kofiCard?.earns, false)
  assert.ok((adaCard?.photosCount ?? 0) >= 1)
  assert.ok((kofiCard?.photosCount ?? 0) >= 1)

  const missing = await app.inject({ method: 'GET', url: '/api/models/nomsa-dlamini' })
  assert.equal(missing.statusCode, 404)

  const ada = await app.inject({ method: 'GET', url: '/api/models/ada-molefe' })
  assert.equal(ada.statusCode, 200)
  const adaProfile = ada.json() as {
    model: { handle: string; earns: boolean; photographerHandle: string | null }
    items: { id: string; photographer: string; appearances?: { inviteEmail?: string | null; modelHandle?: string | null }[] }[]
  }
  assert.equal(adaProfile.model.handle, 'ada-molefe')
  assert.equal(adaProfile.model.earns, false)
  assert.equal(adaProfile.model.photographerHandle, null)
  assert.equal(adaProfile.items.some((p) => p.id === 'afr-001'), true)
  assert.equal(adaProfile.items.every((p) => p.photographer !== 'ada-molefe'), true)
  assert.equal(adaProfile.items.find((p) => p.id === 'afr-001')?.photographer, 'thandiwe-nkosi')
  assert.equal(JSON.stringify(adaProfile).includes('ada@vuekumi.demo'), false)
  assert.equal(JSON.stringify(ada.json()).toLowerCase().includes('book this model'), false)

  const kofiModel = await app.inject({ method: 'GET', url: '/api/models/kofi-mensah' })
  assert.equal(kofiModel.statusCode, 200)
  const kofiPortfolio = kofiModel.json() as {
    model: { photographerHandle: string | null; earns: boolean }
    items: { id: string; photographer: string }[]
    total: number
  }
  assert.equal(kofiPortfolio.model.photographerHandle, 'kofi-mensah')
  assert.equal(kofiPortfolio.model.earns, false)
  assert.equal(kofiPortfolio.items.some((p) => p.id === 'afr-027'), true)
  assert.equal(kofiPortfolio.items.find((p) => p.id === 'afr-027')?.photographer, 'kofi-mensah')
  assert.equal(JSON.stringify(kofiPortfolio).includes('kofi-mensah@vuekumi.demo'), false)

  const kofiPhotographer = await app.inject({ method: 'GET', url: '/api/photographers/kofi-mensah' })
  assert.equal(kofiPhotographer.statusCode, 200)
  const kofiPhotos = kofiPhotographer.json() as {
    photographer: { modelHandle?: string | null }
    items: { id: string }[]
    total: number
  }
  assert.equal(kofiPhotos.photographer.modelHandle, 'kofi-mensah')
  assert.ok(kofiPhotos.total > kofiPortfolio.total)

  const photo = await app.inject({ method: 'GET', url: '/api/photos/afr-001' })
  assert.equal(photo.statusCode, 200)
  const afr001 = photo.json() as {
    photographer: string
    appearances?: { displayName: string; modelHandle?: string | null; inviteEmail?: string | null }[]
  }
  assert.equal(afr001.photographer, 'thandiwe-nkosi')
  const adaAppearance = afr001.appearances?.find((row) => row.modelHandle === 'ada-molefe')
  assert.ok(adaAppearance)
  assert.equal(adaAppearance?.inviteEmail, undefined)
  assert.equal(JSON.stringify(afr001).includes('ada@vuekumi.demo'), false)

  await app.close()
})
