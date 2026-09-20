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
  suspendPolicy,
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
  const d = detail.json() as {
    policy: {
      id: string
      gates: Array<{ id: string; code: string; evidence: unknown[] }>
      featureScopes: Array<{ action: string; state: string }>
      transitions: unknown[]
    }
  }
  assert.equal(d.policy.gates.length, 16)
  assert.ok(d.policy.featureScopes.length >= 7)
  assert.ok(d.policy.transitions.length >= 1)

  const gate = d.policy.gates.find((g) => g.code === 'G01')
  assert.ok(gate)
  const patched = await app.inject({
    method: 'PATCH',
    url: `/api/admin/countries/activation/gates/${gate.id}`,
    headers: { cookie: jar },
    payload: {
      status: 'RESEARCHING',
      rationale: 'Phase 53 evidence polish test',
      evidence: {
        label: 'Matrix research note',
        url: 'https://example.com/country-matrix/ke-g01',
      },
    },
  })
  assert.equal(patched.statusCode, 200, patched.body)
  const afterGate = (patched.json() as { policy: { gates: Array<{ code: string; evidence: Array<{ url: string | null }> }> } }).policy
  const g01 = afterGate.gates.find((g) => g.code === 'G01')
  assert.ok(g01?.evidence.some((e) => e.url === 'https://example.com/country-matrix/ke-g01'))

  const scope = await app.inject({
    method: 'PATCH',
    url: `/api/admin/countries/activation/${d.policy.id}/scopes/new_license`,
    headers: { cookie: jar },
    payload: { state: 'CONDITIONAL', notes: 'Staff draft before ACTIVE' },
  })
  assert.equal(scope.statusCode, 200, scope.body)
  const scopes = (scope.json() as { policy: { featureScopes: Array<{ action: string; state: string }> } }).policy.featureScopes
  assert.equal(scopes.find((s) => s.action === 'new_license')?.state, 'CONDITIONAL')

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

test('Phase 54: license.issue legacy ALLOW; ACTIVE hold DENY; suspend DENY; ON ALLOW', async () => {
  // No ACTIVE/SUSPENDED regulating policy → marketplace continues (HOLD-era).
  const legacy = await evaluatePolicy({ action: 'license.issue', countryCode: 'NG' })
  assert.equal(legacy.decision, 'ALLOW')
  assert.ok(legacy.reasonCodes.includes('legacy_pass_through_no_active_policy'))

  const admin = await prisma.user.findFirst({ where: { email: 'admin@vuekumi.com' } })
  assert.ok(admin)
  const policy = await freshHoldPolicy('LS', admin.id)
  for (const gate of policy.gates) {
    await patchGate({
      gateId: gate.id,
      actorId: admin.id,
      status: 'APPROVED',
      evidence: { label: 'Phase 54 gate' },
    })
  }
  await submitPolicyForReview(policy.id, admin.id)
  const other = await prisma.user.findFirst({
    where: { email: 'support@vuekumi.demo', accountType: 'admin' },
  })
  const authorizerId = other?.id ?? 'authorizer-phase54'
  if (!other) {
    // Separation of duties needs a different actor id string when support admin missing
  }
  const activated = await authorizeActivation({
    policyVersionId: policy.id,
    authorizerId: authorizerId === admin.id ? 'authorizer-phase54-alt' : authorizerId,
    notes: 'Phase 54 activate',
  })
  assert.equal(activated.status, 'ACTIVE')

  // Default ACTIVE scopes hold new_license
  const held = await evaluatePolicy({ action: 'license.issue', countryCode: 'LS' })
  assert.equal(held.decision, 'DENY')
  assert.ok(held.reasonCodes.includes('feature_scope_not_on:new_license'))

  await prisma.countryFeatureScope.update({
    where: { policyVersionId_action: { policyVersionId: policy.id, action: 'new_license' } },
    data: { state: 'ON' },
  })
  const open = await evaluatePolicy({ action: 'license.issue', countryCode: 'LS' })
  assert.equal(open.decision, 'ALLOW')
  assert.ok(open.reasonCodes.includes('new_license_on'))

  const grantsBefore = await prisma.licenseGrant.count()
  await suspendPolicy({ policyVersionId: policy.id, actorId: admin.id, notes: 'Phase 54 suspend' })
  const suspended = await evaluatePolicy({ action: 'license.issue', countryCode: 'LS' })
  assert.equal(suspended.decision, 'DENY')
  assert.ok(suspended.reasonCodes.includes('market_suspended'))
  const grantsAfter = await prisma.licenseGrant.count()
  assert.equal(grantsAfter, grantsBefore, 'suspend must not revoke historical grants')

  await prisma.countryPolicyVersion.delete({ where: { id: policy.id } }).catch(() => undefined)
})

test('Phase 56: contributor.upload legacy ALLOW; ACTIVE ON; suspend DENY; route 403', async () => {
  const legacy = await evaluatePolicy({ action: 'contributor.upload', countryCode: 'NG' })
  assert.equal(legacy.decision, 'ALLOW')
  assert.ok(legacy.reasonCodes.includes('legacy_pass_through_no_active_policy'))

  const admin = await prisma.user.findFirst({ where: { email: 'admin@vuekumi.com' } })
  assert.ok(admin)
  const policy = await freshHoldPolicy('GH', admin.id)
  for (const gate of policy.gates) {
    await patchGate({
      gateId: gate.id,
      actorId: admin.id,
      status: 'APPROVED',
      evidence: { label: 'Phase 56 gate' },
    })
  }
  await submitPolicyForReview(policy.id, admin.id)
  const other = await prisma.user.findFirst({
    where: { email: 'support@vuekumi.demo', accountType: 'admin' },
  })
  const authorizerId = other?.id && other.id !== admin.id ? other.id : 'authorizer-phase56'
  await authorizeActivation({
    policyVersionId: policy.id,
    authorizerId,
    notes: 'Phase 56 activate',
  })

  // Default ACTIVE scopes turn contributor_upload ON
  const open = await evaluatePolicy({ action: 'contributor.upload', countryCode: 'GH' })
  assert.equal(open.decision, 'ALLOW')
  assert.ok(open.reasonCodes.includes('contributor_upload_on'))

  await prisma.countryFeatureScope.update({
    where: { policyVersionId_action: { policyVersionId: policy.id, action: 'contributor_upload' } },
    data: { state: 'HOLD' },
  })
  const held = await evaluatePolicy({ action: 'contributor.upload', countryCode: 'GH' })
  assert.equal(held.decision, 'DENY')
  assert.ok(held.reasonCodes.includes('feature_scope_not_on:contributor_upload'))

  // Put scopes back ON then suspend — suspend holds upload
  await prisma.countryFeatureScope.update({
    where: { policyVersionId_action: { policyVersionId: policy.id, action: 'contributor_upload' } },
    data: { state: 'ON' },
  })
  await suspendPolicy({ policyVersionId: policy.id, actorId: admin.id, notes: 'Phase 56 suspend' })
  const suspended = await evaluatePolicy({ action: 'contributor.upload', countryCode: 'GH' })
  assert.equal(suspended.decision, 'DENY')
  assert.ok(suspended.reasonCodes.includes('market_suspended'))

  // Route: set a Ghana photographer and expect presign 403
  const photographer = await prisma.user.findFirst({
    where: { email: 'amara-okafor@vuekumi.demo' },
  })
  assert.ok(photographer)
  await prisma.user.update({ where: { id: photographer.id }, data: { country: 'GH' } })

  const app = await buildApp()
  const jar = await login(app, 'amara-okafor@vuekumi.demo', 'User12345!')
  const denied = await app.inject({
    method: 'POST',
    url: '/api/contributor/uploads/presign',
    headers: { cookie: jar },
    payload: { filename: 'test.jpg', contentType: 'image/jpeg' },
  })
  assert.equal(denied.statusCode, 403, denied.body)
  assert.match(denied.json().error ?? '', /upload|suspended|market/i)

  await prisma.user.update({ where: { id: photographer.id }, data: { country: 'NG' } }).catch(() => undefined)
  await prisma.countryPolicyVersion.delete({ where: { id: policy.id } }).catch(() => undefined)
  await app.close()
})
