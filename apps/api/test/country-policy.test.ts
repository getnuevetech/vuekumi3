import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  allGatesReadyForActivation,
  COUNTRY_GATE_CODES,
  COUNTRY_GATE_TITLES,
  DEFAULT_CONTRIBUTOR_ONBOARDING_POLICY,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import {
  authorizeActivation,
  evaluatePolicy,
  patchGate,
  submitPolicyForReview,
} from '../src/lib/policy-decision.js'
import { assertContributorCountry } from '../src/lib/geo.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`)
  return cookies(res)
}

async function freshHoldPolicy(countryCode: string, preparedById: string) {
  const latest = await prisma.countryPolicyVersion.findFirst({
    where: { countryCode },
    orderBy: { version: 'desc' },
  })
  const version = (latest?.version ?? 0) + 1
  return prisma.countryPolicyVersion.create({
    data: {
      countryCode,
      version,
      status: 'HOLD',
      preparedById,
      gates: {
        create: COUNTRY_GATE_CODES.map((code) => ({
          code,
          title: COUNTRY_GATE_TITLES[code],
          status: 'NOT_STARTED',
        })),
      },
      transitions: {
        create: {
          kind: 'draft',
          fromStatus: 'HOLD',
          toStatus: 'HOLD',
          actorId: preparedById,
          notes: 'test draft',
        },
      },
    },
    include: {
      gates: { include: { evidence: true, approvals: true }, orderBy: { code: 'asc' } },
      featureScopes: true,
      transitions: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
}

test('shared: all 16 gates required for activation', () => {
  assert.equal(COUNTRY_GATE_CODES.length, 16)
  assert.equal(DEFAULT_CONTRIBUTOR_ONBOARDING_POLICY, 'africa_list')
  const incomplete = allGatesReadyForActivation(
    COUNTRY_GATE_CODES.map((code) => ({ code, status: 'NOT_STARTED' as const })),
  )
  assert.equal(incomplete.ok, false)
  if (!incomplete.ok) assert.equal(incomplete.missing.length, 16)

  const ready = allGatesReadyForActivation(
    COUNTRY_GATE_CODES.map((code) => ({ code, status: 'APPROVED' as const })),
  )
  assert.equal(ready.ok, true)
})

test('PDS: Africa list ALLOW under default onboarding; Canada DENY; rights.invite ALLOW', async () => {
  const ng = await evaluatePolicy({ action: 'contributor.create', countryCode: 'NG' })
  assert.equal(ng.decision, 'ALLOW')
  assert.ok(ng.reasonCodes.includes('africa_list_ok'))

  const ca = await evaluatePolicy({ action: 'contributor.create', countryCode: 'CA' })
  assert.equal(ca.decision, 'DENY')
  assert.ok(ca.reasonCodes.some((c) => c.includes('l1_') || c.includes('africa') || c.includes('country')))

  const invite = await evaluatePolicy({ action: 'rights.invite', countryCode: 'CA' })
  assert.equal(invite.decision, 'ALLOW')

  await assert.rejects(() => assertContributorCountry('CA'), /African/)
  await assertContributorCountry('NG')
})

test('PDS: activation fails incomplete gates; four-eyes; invalid DB flip', async () => {
  const policy = await freshHoldPolicy('BW', 'preparer-staff-1')
  assert.equal(policy.status, 'HOLD')
  assert.equal(policy.gates.length, 16)

  await assert.rejects(
    () => authorizeActivation({ policyVersionId: policy.id, authorizerId: 'authorizer-2' }),
    /incomplete gates|Activation DENY/,
  )

  for (const gate of policy.gates) {
    await patchGate({
      gateId: gate.id,
      actorId: 'preparer-staff-1',
      status: 'APPROVED',
      evidence: { label: 'Test evidence' },
    })
  }

  await submitPolicyForReview(policy.id, 'preparer-staff-1')

  await assert.rejects(
    () => authorizeActivation({ policyVersionId: policy.id, authorizerId: 'preparer-staff-1' }),
    /Separation of duties/,
  )

  const activated = await authorizeActivation({
    policyVersionId: policy.id,
    authorizerId: 'authorizer-2',
    notes: 'Test activation',
  })
  assert.equal(activated.status, 'ACTIVE')

  // Illegal ACTIVE without activate transition → PDS DENY under strict onboarding
  const bogus = await prisma.countryPolicyVersion.create({
    data: {
      countryCode: 'ZM',
      version: 9000 + Math.floor(Math.random() * 1000),
      status: 'ACTIVE',
      publishedAt: new Date(),
      gates: {
        create: COUNTRY_GATE_CODES.map((code) => ({
          code,
          title: COUNTRY_GATE_TITLES[code],
          status: 'APPROVED',
        })),
      },
    },
  })

  await prisma.platformSetting.upsert({
    where: { key: 'geo.contributor_onboarding_policy' },
    create: {
      key: 'geo.contributor_onboarding_policy',
      value: 'africa_list_and_country_active',
      secret: false,
      label: 'Contributor onboarding policy',
      group: 'Geo / Country policy',
    },
    update: { value: 'africa_list_and_country_active' },
  })

  try {
    const invalid = await evaluatePolicy({ action: 'contributor.create', countryCode: 'ZM' })
    assert.equal(invalid.decision, 'DENY')
    assert.ok(
      invalid.reasonCodes.includes('policy_invalid_no_transition')
        || invalid.reasonCodes.some((c) => c.includes('feature_scope')),
    )
  } finally {
    await prisma.platformSetting.upsert({
      where: { key: 'geo.contributor_onboarding_policy' },
      create: {
        key: 'geo.contributor_onboarding_policy',
        value: 'africa_list',
        secret: false,
        label: 'Contributor onboarding policy',
        group: 'Geo / Country policy',
      },
      update: { value: 'africa_list' },
    })
    await prisma.countryPolicyVersion.delete({ where: { id: bogus.id } }).catch(() => {})
  }
})

test('admin activation register + evaluate route', async () => {
  const app = await buildApp()
  const jar = await login(app, 'admin@vuekumi.com', 'Admin123!')

  const seed = await app.inject({
    method: 'POST',
    url: '/api/admin/countries/activation/seed-hold',
    headers: { cookie: jar },
  })
  assert.equal(seed.statusCode, 200, seed.body)

  const list = await app.inject({
    method: 'GET',
    url: '/api/admin/countries/activation',
    headers: { cookie: jar },
  })
  assert.equal(list.statusCode, 200, list.body)
  const body = list.json() as { countries: Array<{ code: string; policy: { status: string } | null }> }
  assert.ok(body.countries.length > 40)

  const detail = await app.inject({
    method: 'GET',
    url: '/api/admin/countries/KE/activation',
    headers: { cookie: jar },
  })
  assert.equal(detail.statusCode, 200, detail.body)
  const d = detail.json() as { policy: { gates: unknown[] } }
  assert.equal(d.policy.gates.length, 16)

  const evalRes = await app.inject({
    method: 'POST',
    url: '/api/policy/evaluate',
    headers: { cookie: jar },
    payload: { action: 'contributor.create', countryCode: 'CA' },
  })
  assert.equal(evalRes.statusCode, 200, evalRes.body)
  assert.equal(evalRes.json().decision, 'DENY')

  await app.close()
})
