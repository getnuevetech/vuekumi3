import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  brandProjectCloseBlocked,
  brandProjectEditBlocked,
  createBrandProjectSchema,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('brand studio schemas and close/edit guards', () => {
  const ok = createBrandProjectSchema.parse({ title: 'Lagos launch board', notes: 'Warm tones' })
  assert.equal(ok.title, 'Lagos launch board')
  assert.throws(() => createBrandProjectSchema.parse({ title: 'ab' }))
  assert.equal(brandProjectCloseBlocked('open'), null)
  assert.match(brandProjectCloseBlocked('closed')!, /already closed/)
  assert.match(brandProjectEditBlocked('closed')!, /cannot be edited/)
})

test('brand studio: buyer creates project, attaches lightbox, closes; contributors blocked', async () => {
  const app = await buildApp()

  const memberLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'member@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(memberLogin.statusCode, 200)
  const member = cookies(memberLogin)

  const photographerLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(photographerLogin.statusCode, 200)
  const photographer = cookies(photographerLogin)

  const blocked = await app.inject({
    method: 'GET',
    url: '/api/brand/projects',
    headers: { cookie: photographer },
  })
  assert.equal(blocked.statusCode, 403)

  const collection = await app.inject({
    method: 'POST',
    url: '/api/collections',
    headers: { cookie: member },
    payload: { name: `Brand board ${Date.now()}` },
  })
  assert.equal(collection.statusCode, 200, collection.body)
  const collectionId = (collection.json() as { collection: { id: string } }).collection.id

  const created = await app.inject({
    method: 'POST',
    url: '/api/brand/projects',
    headers: { cookie: member },
    payload: {
      title: 'West Africa moodboard',
      notes: 'Reference stills for Q4 cutdowns.',
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const project = (created.json() as { project: { id: string; status: string; collections: unknown[] } }).project
  assert.equal(project.status, 'open')
  assert.equal(project.collections.length, 0)

  const attached = await app.inject({
    method: 'POST',
    url: `/api/brand/projects/${project.id}/collections`,
    headers: { cookie: member },
    payload: { collectionId },
  })
  assert.equal(attached.statusCode, 200, attached.body)
  const withCollection = (attached.json() as { project: { collections: { id: string }[] } }).project
  assert.equal(withCollection.collections.length, 1)
  assert.equal(withCollection.collections[0]?.id, collectionId)

  const closed = await app.inject({
    method: 'POST',
    url: `/api/brand/projects/${project.id}/close`,
    headers: { cookie: member },
  })
  assert.equal(closed.statusCode, 200, closed.body)
  assert.equal((closed.json() as { project: { status: string } }).project.status, 'closed')

  const editClosed = await app.inject({
    method: 'POST',
    url: `/api/brand/projects/${project.id}/collections`,
    headers: { cookie: member },
    payload: { collectionId },
  })
  assert.equal(editClosed.statusCode, 400)

  const list = await app.inject({
    method: 'GET',
    url: '/api/brand/projects',
    headers: { cookie: member },
  })
  assert.equal(list.statusCode, 200)
  const items = (list.json() as { items: { id: string }[] }).items
  assert.ok(items.some((i) => i.id === project.id))

  await prisma.brandProject.delete({ where: { id: project.id } }).catch(() => undefined)
  await prisma.collection.delete({ where: { id: collectionId } }).catch(() => undefined)
})
