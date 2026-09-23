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

test('settings hides gateway and AI keys, and those pages show a legacy key without returning it', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const stripe = await prisma.paymentGateway.findUnique({ where: { slug: 'stripe' } })
  const openai = await prisma.aiProvider.findUnique({ where: { slug: 'openai' } })
  assert.ok(stripe)
  assert.ok(openai)
  const previousGateway = {
    configEnc: stripe.configEnc,
    webhookSecretEnc: stripe.webhookSecretEnc,
    publicKey: stripe.publicKey,
  }
  const previousAi = { apiKeyEnc: openai.apiKeyEnc, modelName: openai.modelName }
  const settingKeys = ['payments.stripe.secret_key', 'payments.stripe.publishable_key', 'ai.openai_api_key', 'ai.openai_model']
  const previousSettings = await prisma.platformSetting.findMany({ where: { key: { in: settingKeys } } })

  await prisma.paymentGateway.update({
    where: { id: stripe.id },
    data: { configEnc: null, webhookSecretEnc: null, publicKey: null },
  })
  await prisma.aiProvider.update({
    where: { id: openai.id },
    data: { apiKeyEnc: null, modelName: null },
  })
  await prisma.platformSetting.deleteMany({ where: { key: { in: settingKeys } } })
  await prisma.platformSetting.createMany({
    data: [
      { key: 'payments.stripe.secret_key', value: encryptSecret('sk_test_legacysettingskey'), secret: true, label: 'Stripe secret key', group: 'Payments — Stripe' },
      { key: 'payments.stripe.publishable_key', value: 'pk_test_legacysettings', secret: false, label: 'Stripe publishable key', group: 'Payments — Stripe' },
      { key: 'ai.openai_api_key', value: encryptSecret('sk-legacy-openai-key'), secret: true, label: 'OpenAI API key', group: 'AI' },
      { key: 'ai.openai_model', value: 'gpt-4o-mini', secret: false, label: 'OpenAI vision model', group: 'AI' },
    ],
  })

  try {
    const settings = await app.inject({ method: 'GET', url: '/api/admin/settings', headers: { cookie: admin } })
    assert.equal(settings.statusCode, 200, settings.body)
    const keys = (settings.json() as { settings: { key: string }[] }).settings.map((row) => row.key)
    assert.equal(keys.includes('payments.stripe.secret_key'), false)
    assert.equal(keys.includes('payments.flutterwave.secret_key'), false)
    assert.equal(keys.includes('ai.openai_api_key'), false)
    assert.equal(keys.includes('ai.replicate_api_token'), false)
    assert.equal(keys.includes('payments.contributor_share'), true)
    assert.equal(keys.includes('email.resend_api_key'), true)

    const gateways = await app.inject({ method: 'GET', url: '/api/admin/gateways', headers: { cookie: admin } })
    assert.equal(gateways.statusCode, 200, gateways.body)
    const stripeRow = (gateways.json() as { gateways: Array<Record<string, unknown>> }).gateways.find((row) => row.slug === 'stripe')
    assert.equal(stripeRow?.secretSource, 'settings')
    assert.equal(stripeRow?.hasSecret, true)
    assert.match(String(stripeRow?.secretMasked), /skey/)
    assert.equal(stripeRow?.publicKey, 'pk_test_legacysettings')
    assert.equal(JSON.stringify(gateways.json()).includes('sk_test_legacysettingskey'), false)

    const providers = await app.inject({ method: 'GET', url: '/api/admin/ai-providers', headers: { cookie: admin } })
    const openaiRow = (providers.json() as { providers: Array<Record<string, unknown>> }).providers.find((row) => row.slug === 'openai')
    assert.equal(openaiRow?.keySource, 'settings')
    assert.equal(openaiRow?.model, 'gpt-4o-mini')
    assert.equal(openaiRow?.modelSource, 'settings')
    assert.equal(JSON.stringify(providers.json()).includes('sk-legacy-openai-key'), false)

    const rejected = await app.inject({
      method: 'PATCH',
      url: `/api/admin/gateways/${stripe.id}`,
      headers: { cookie: admin },
      payload: { secretKey: 'pk_test_not_a_secret' },
    })
    assert.equal(rejected.statusCode, 400, rejected.body)
    assert.match(rejected.json().error as string, /publishable key/)

    const saved = await app.inject({
      method: 'PATCH',
      url: `/api/admin/gateways/${stripe.id}`,
      headers: { cookie: admin },
      payload: { secretKey: 'sk_test_moved_to_gateway', webhookSecret: 'whsec_moved', publicKey: 'pk_test_on_gateway', name: 'Stripe' },
    })
    assert.equal(saved.statusCode, 200, saved.body)
    const savedGateway = saved.json() as { gateway: { secretSource: string; webhookSource: string; secretMasked: string; publicKeySource: string } }
    assert.equal(savedGateway.gateway.secretSource, 'gateway')
    assert.equal(savedGateway.gateway.webhookSource, 'gateway')
    assert.equal(savedGateway.gateway.publicKeySource, 'gateway')
    assert.match(savedGateway.gateway.secretMasked, /eway/)

    const savedAi = await app.inject({
      method: 'PATCH',
      url: `/api/admin/ai-providers/${openai.id}`,
      headers: { cookie: admin },
      payload: { model: 'gpt-4.1-mini', apiKey: 'sk-moved-onto-provider' },
    })
    assert.equal(savedAi.statusCode, 200, savedAi.body)
    const savedProvider = savedAi.json() as { provider: { model: string; modelSource: string; keySource: string } }
    assert.equal(savedProvider.provider.model, 'gpt-4.1-mini')
    assert.equal(savedProvider.provider.modelSource, 'provider')
    assert.equal(savedProvider.provider.keySource, 'provider')
  } finally {
    await prisma.paymentGateway.update({ where: { id: stripe.id }, data: previousGateway })
    await prisma.aiProvider.update({ where: { id: openai.id }, data: previousAi })
    await prisma.platformSetting.deleteMany({ where: { key: { in: settingKeys } } })
    if (previousSettings.length) {
      await prisma.platformSetting.createMany({
        data: previousSettings.map((row) => ({
          key: row.key,
          value: row.value,
          secret: row.secret,
          label: row.label,
          group: row.group,
        })),
      })
    }
    await app.close()
  }
})
