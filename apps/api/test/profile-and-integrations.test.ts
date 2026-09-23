import assert from 'node:assert/strict'
import { test } from 'node:test'
import { personNameFrom, registerSchema, splitDisplayName } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { encryptSecret } from '../src/lib/settings.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`)
  return cookies(res)
}

test('display names split on the first space and profile forms require both fields', () => {
  assert.deepEqual(splitDisplayName('Ada Lovelace'), { firstName: 'Ada', lastName: 'Lovelace' })
  assert.deepEqual(splitDisplayName('Ada'), { firstName: 'Ada', lastName: '' })
  assert.deepEqual(personNameFrom({ firstName: 'Ada', lastName: 'Lovelace' }), {
    firstName: 'Ada',
    lastName: 'Lovelace',
    name: 'Ada Lovelace',
  })
  assert.equal(personNameFrom({ name: 'Staff Photographer' }).lastName, 'Photographer')
  assert.equal(registerSchema.safeParse({
    email: 'p@example.com',
    password: 'password1',
    name: 'Ada',
    accountType: 'photographer',
  }).success, true)
  assert.equal(registerSchema.safeParse({
    email: 'p@example.com',
    password: 'password1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    accountType: 'user',
  }).success, true)
  assert.equal(registerSchema.safeParse({
    email: 'p@example.com',
    password: 'password1',
    firstName: 'Ada',
    accountType: 'user',
  }).success, false)
})

test('signup stores first and last name separately', async () => {
  const app = await buildApp()
  const email = `names-${Date.now()}@vuekumi.demo`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email,
      password: 'User12345!',
      firstName: 'Zola',
      lastName: 'Mensah',
      accountType: 'user',
    },
  })
  assert.equal(res.statusCode, 200, res.body)
  const user = res.json().user as { name: string; firstName: string; lastName: string }
  assert.equal(user.firstName, 'Zola')
  assert.equal(user.lastName, 'Mensah')
  assert.equal(user.name, 'Zola Mensah')
  await prisma.user.deleteMany({ where: { email } })
  await app.close()
})

test('gateway and AI lists survive a bad secret and duplicate slugs are not a 500', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const stripe = await prisma.paymentGateway.findUnique({ where: { slug: 'stripe' } })
  const openai = await prisma.aiProvider.findUnique({ where: { slug: 'openai' } })
  assert.ok(stripe)
  assert.ok(openai)
  const previousGateway = stripe.configEnc
  const previousAi = openai.apiKeyEnc

  await prisma.paymentGateway.update({
    where: { id: stripe.id },
    data: { configEnc: 'enc:not-a-real-iv:not-a-real-tag:abcd' },
  })
  await prisma.aiProvider.update({
    where: { id: openai.id },
    data: { apiKeyEnc: 'enc:not-a-real-iv:not-a-real-tag:abcd' },
  })

  try {
  const gateways = await app.inject({
    method: 'GET',
    url: '/api/admin/gateways',
    headers: { cookie: admin },
  })
  assert.equal(gateways.statusCode, 200, gateways.body)
  const stripeRow = (gateways.json() as { gateways: { slug: string; hasSecret: boolean; secretReadable: boolean }[] })
    .gateways.find((row) => row.slug === 'stripe')
  assert.equal(stripeRow?.hasSecret, true)
  assert.equal(stripeRow?.secretReadable, false)

  const providers = await app.inject({
    method: 'GET',
    url: '/api/admin/ai-providers',
    headers: { cookie: admin },
  })
  assert.equal(providers.statusCode, 200, providers.body)
  const openaiRow = (providers.json() as { providers: { slug: string; hasKey: boolean; keyReadable: boolean }[] })
    .providers.find((row) => row.slug === 'openai')
  assert.equal(openaiRow?.hasKey, true)
  assert.equal(openaiRow?.keyReadable, false)

  const duplicateGateway = await app.inject({
    method: 'POST',
    url: '/api/admin/gateways',
    headers: { cookie: admin },
    payload: { name: 'Stripe again', slug: 'Stripe', kind: 'checkout', countries: ['NG'], currencies: ['USD'] },
  })
  assert.equal(duplicateGateway.statusCode, 409, duplicateGateway.body)
  assert.match(duplicateGateway.json().error as string, /already exists/)
  assert.doesNotMatch(duplicateGateway.json().error as string, /Internal server error/)

  const duplicateAi = await app.inject({
    method: 'POST',
    url: '/api/admin/ai-providers',
    headers: { cookie: admin },
    payload: { name: 'OpenAI again', slug: 'OpenAI', purpose: 'image_analysis', apiBaseUrl: 'https://api.openai.com/v1' },
  })
  assert.equal(duplicateAi.statusCode, 409, duplicateAi.body)
  assert.match(duplicateAi.json().error as string, /already exists/)

  const saved = await app.inject({
    method: 'PATCH',
    url: `/api/admin/gateways/${stripe.id}`,
    headers: { cookie: admin },
    payload: { secretKey: 'sk_test_gateway_save', countries: ['NG', 'KE'] },
  })
  assert.equal(saved.statusCode, 200, saved.body)
  const savedBody = saved.json() as { gateway: { hasSecret: boolean; secretReadable: boolean; secretMasked: string; countries: string[] } }
  assert.equal(savedBody.gateway.hasSecret, true)
  assert.equal(savedBody.gateway.secretReadable, true)
  assert.match(savedBody.gateway.secretMasked, /save/)
  assert.deepEqual(savedBody.gateway.countries, ['NG', 'KE'])

  const savedAi = await app.inject({
    method: 'PATCH',
    url: `/api/admin/ai-providers/${openai.id}`,
    headers: { cookie: admin },
    payload: { apiKey: 'sk-test-ai-provider-key', apiBaseUrl: 'https://api.openai.com/v1' },
  })
  assert.equal(savedAi.statusCode, 200, savedAi.body)
  assert.equal((savedAi.json() as { provider: { keyReadable: boolean } }).provider.keyReadable, true)

  const toggled = await app.inject({
    method: 'PATCH',
    url: `/api/admin/gateways/${stripe.id}`,
    headers: { cookie: admin },
    payload: { enabled: stripe.enabled },
  })
  assert.equal(toggled.statusCode, 200, toggled.body)
  const afterToggle = await prisma.paymentGateway.findUnique({ where: { id: stripe.id } })
  assert.deepEqual(afterToggle?.countries, ['NG', 'KE'])

  assert.equal(encryptSecret('sk_test_roundtrip').startsWith('enc:'), true)
  } finally {
    await prisma.paymentGateway.update({
      where: { id: stripe.id },
      data: { configEnc: previousGateway, countries: stripe.countries },
    })
    await prisma.aiProvider.update({
      where: { id: openai.id },
      data: { apiKeyEnc: previousAi },
    })
    await app.close()
  }
})
