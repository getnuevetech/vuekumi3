import {
  allGatesReadyForActivation,
  COUNTRY_GATE_CODES,
  COUNTRY_GATE_TITLES,
  DEFAULT_CONTRIBUTOR_ONBOARDING_POLICY,
  defaultFeatureScopesForActivation,
  FEATURE_SCOPE_ACTIONS,
  type ContributorOnboardingPolicy,
  type CountryGateCode,
  type CountryPolicyStatus,
  type FeatureScopeAction,
  type FeatureScopeState,
  type GateStatus,
  type PolicyAction,
  type PolicyEvaluateInput,
  type PolicyEvaluateResult,
} from '@vuekumi/shared'
import { getSettingSafe } from './settings.js'
import { prisma } from './prisma.js'

const policyInclude = {
  gates: { include: { evidence: true, approvals: true }, orderBy: { code: 'asc' as const } },
  featureScopes: true,
  transitions: { orderBy: { createdAt: 'desc' as const }, take: 20 },
}

export type PolicyVersionRow = Awaited<ReturnType<typeof getLatestPolicyVersion>>

export async function getContributorOnboardingPolicy(): Promise<ContributorOnboardingPolicy> {
  const raw = (await getSettingSafe('geo.contributor_onboarding_policy'))?.trim()
  if (raw === 'africa_list_and_country_active') return 'africa_list_and_country_active'
  return DEFAULT_CONTRIBUTOR_ONBOARDING_POLICY
}

export async function getLatestPolicyVersion(countryCode: string) {
  return prisma.countryPolicyVersion.findFirst({
    where: { countryCode: countryCode.toUpperCase() },
    orderBy: { version: 'desc' },
    include: policyInclude,
  })
}

export async function getActivePolicyVersion(countryCode: string) {
  return prisma.countryPolicyVersion.findFirst({
    where: { countryCode: countryCode.toUpperCase(), status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    include: policyInclude,
  })
}

/**
 * Phase 54 — policy that regulates new licenses: ACTIVE, or post-ACTIVE SUSPENDED
 * (so suspend mid-checkout still DENYs new grants while historical grants stay).
 */
export async function getRegulatingLicensePolicy(countryCode: string) {
  const code = countryCode.toUpperCase()
  const active = await getActivePolicyVersion(code)
  if (active) return active
  return prisma.countryPolicyVersion.findFirst({
    where: { countryCode: code, status: 'SUSPENDED' },
    orderBy: { version: 'desc' },
    include: policyInclude,
  })
}

function emptyGates() {
  return COUNTRY_GATE_CODES.map((code) => ({
    code,
    title: COUNTRY_GATE_TITLES[code],
    status: 'NOT_STARTED' as GateStatus,
  }))
}

function holdFeatureScopeCreates() {
  return FEATURE_SCOPE_ACTIONS.map((action) => ({
    action,
    state: 'HOLD' as FeatureScopeState,
  }))
}

/** Backfill HOLD feature scopes so staff can edit scopes before ACTIVE. */
async function ensureHoldFeatureScopes(policyVersionId: string) {
  for (const action of FEATURE_SCOPE_ACTIONS) {
    await prisma.countryFeatureScope.upsert({
      where: { policyVersionId_action: { policyVersionId, action } },
      create: { policyVersionId, action, state: 'HOLD' },
      update: {},
    })
  }
}

/** Ensure every Country has at least one HOLD policy version with G01–G16. */
export async function ensureCountryPolicyHold(countryCode: string, preparedById?: string) {
  const code = countryCode.toUpperCase()
  const existing = await getLatestPolicyVersion(code)
  if (existing) {
    if (existing.featureScopes.length < FEATURE_SCOPE_ACTIONS.length) {
      await ensureHoldFeatureScopes(existing.id)
      return (await getLatestPolicyVersion(code))!
    }
    return existing
  }

  const country = await prisma.country.findUnique({ where: { code } })
  if (!country) {
    throw Object.assign(new Error(`Country ${code} not found`), { statusCode: 404 })
  }

  return prisma.countryPolicyVersion.create({
    data: {
      countryCode: code,
      version: 1,
      status: 'HOLD',
      preparedById: preparedById ?? null,
      gates: {
        create: emptyGates(),
      },
      featureScopes: {
        create: holdFeatureScopeCreates(),
      },
      transitions: {
        create: {
          kind: 'draft',
          fromStatus: 'HOLD',
          toStatus: 'HOLD',
          actorId: preparedById ?? 'system',
          notes: 'Initial HOLD policy version (Phase 49 / P0)',
        },
      },
    },
    include: policyInclude,
  })
}

/** Import HOLD policy rows for all countries that lack one (54 Africa + buyers). */
export async function seedHoldPoliciesForAllCountries(actorId = 'system') {
  const countries = await prisma.country.findMany({ select: { code: true } })
  let created = 0
  for (const c of countries) {
    const before = await prisma.countryPolicyVersion.count({ where: { countryCode: c.code } })
    await ensureCountryPolicyHold(c.code, actorId === 'system' ? undefined : actorId)
    const after = await prisma.countryPolicyVersion.count({ where: { countryCode: c.code } })
    if (after > before) created += 1
  }
  return { countries: countries.length, created }
}

export async function listCountryActivationRegister() {
  const countries = await prisma.country.findMany({
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
    include: {
      legalOverlay: true,
      policyVersions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: {
          gates: true,
          featureScopes: true,
          transitions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })

  return countries.map((c) => {
    const policy = c.policyVersions[0] ?? null
    const gates = policy?.gates ?? []
    const ready = policy
      ? allGatesReadyForActivation(gates.map((g) => ({ code: g.code, status: g.status as GateStatus })))
      : { ok: false as const, missing: [...COUNTRY_GATE_CODES] }
    return {
      code: c.code,
      name: c.name,
      region: c.region,
      contributorEligible: c.contributorEligible,
      enabled: c.enabled,
      overlayKind: c.legalOverlay?.overlayKind ?? null,
      counselStatus: c.legalOverlay?.counselStatus ?? 'placeholder',
      policy: policy
        ? {
            id: policy.id,
            version: policy.version,
            status: policy.status as CountryPolicyStatus,
            preparedById: policy.preparedById,
            publishedAt: policy.publishedAt?.toISOString() ?? null,
            gatesReady: ready.ok,
            gatesMissing: ready.ok ? [] : ready.missing,
            gateCounts: {
              total: gates.length,
              approved: gates.filter((g) => g.status === 'APPROVED').length,
              notApplicable: gates.filter((g) => g.status === 'NOT_APPLICABLE').length,
              blocked: gates.filter((g) => g.status === 'BLOCKED').length,
              open: gates.filter((g) => g.status === 'NOT_STARTED' || g.status === 'RESEARCHING').length,
            },
            lastTransitionKind: policy.transitions[0]?.kind ?? null,
          }
        : null,
    }
  })
}

export async function getCountryActivationDetail(countryCode: string) {
  const code = countryCode.toUpperCase()
  const country = await prisma.country.findUnique({
    where: { code },
    include: { legalOverlay: true },
  })
  if (!country) return null
  const policy = await ensureCountryPolicyHold(code)
  return { country, policy }
}

export async function patchGate(input: {
  gateId: string
  actorId: string
  status?: GateStatus
  rationale?: string | null
  evidence?: { label: string; url?: string; notes?: string }
}) {
  const gate = await prisma.countryGate.findUnique({
    where: { id: input.gateId },
    include: { policyVersion: true },
  })
  if (!gate) {
    throw Object.assign(new Error('Gate not found'), { statusCode: 404 })
  }
  if (gate.policyVersion.status === 'ACTIVE' || gate.policyVersion.status === 'OFFBOARDING') {
    throw Object.assign(new Error('Cannot edit gates on an immutable published policy; draft a new version'), {
      statusCode: 400,
    })
  }
  if (input.status === 'NOT_APPLICABLE' && !(input.rationale ?? gate.rationale)?.trim()) {
    throw Object.assign(new Error('NOT_APPLICABLE requires written rationale'), { statusCode: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.countryGate.update({
      where: { id: gate.id },
      data: {
        status: input.status ?? gate.status,
        rationale: input.rationale === undefined ? gate.rationale : input.rationale,
      },
    })
    if (input.evidence?.label) {
      await tx.gateEvidence.create({
        data: {
          gateId: gate.id,
          label: input.evidence.label,
          url: input.evidence.url ?? null,
          notes: input.evidence.notes ?? null,
          addedById: input.actorId,
        },
      })
    }
    if (input.status === 'APPROVED' || input.status === 'NOT_APPLICABLE') {
      await tx.gateApproval.create({
        data: {
          gateId: gate.id,
          approverId: input.actorId,
          decision: input.status,
          notes: input.rationale ?? null,
        },
      })
    }
    return next
  })

  return getLatestPolicyVersion(gate.policyVersion.countryCode)
}

/** Phase 53 / T7 — edit feature scopes on non-ACTIVE drafts (HOLD / REVIEW / SUSPENDED). */
export async function patchFeatureScope(input: {
  policyVersionId: string
  action: FeatureScopeAction
  state: FeatureScopeState
  notes?: string | null
  actorId: string
}) {
  const policy = await prisma.countryPolicyVersion.findUnique({
    where: { id: input.policyVersionId },
  })
  if (!policy) throw Object.assign(new Error('Policy version not found'), { statusCode: 404 })
  if (policy.status === 'ACTIVE' || policy.status === 'OFFBOARDING') {
    throw Object.assign(
      new Error('Cannot edit feature scopes on an immutable published policy; draft a new version'),
      { statusCode: 400 },
    )
  }

  await prisma.countryFeatureScope.upsert({
    where: {
      policyVersionId_action: { policyVersionId: policy.id, action: input.action },
    },
    create: {
      policyVersionId: policy.id,
      action: input.action,
      state: input.state,
      notes: input.notes ?? null,
    },
    update: {
      state: input.state,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  })

  return getLatestPolicyVersion(policy.countryCode)
}

export async function submitPolicyForReview(policyVersionId: string, actorId: string, notes?: string) {
  const policy = await prisma.countryPolicyVersion.findUnique({
    where: { id: policyVersionId },
    include: { gates: true },
  })
  if (!policy) throw Object.assign(new Error('Policy version not found'), { statusCode: 404 })
  if (policy.status !== 'HOLD' && policy.status !== 'REVIEW') {
    throw Object.assign(new Error(`Cannot submit from status ${policy.status}`), { statusCode: 400 })
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.countryPolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'REVIEW', preparedById: actorId },
    })
    await tx.countryTransition.create({
      data: {
        policyVersionId: policy.id,
        kind: 'submit_review',
        fromStatus: policy.status,
        toStatus: 'REVIEW',
        actorId,
        notes: notes ?? null,
      },
    })
    return updated
  })
}

export async function authorizeActivation(input: {
  policyVersionId: string
  authorizerId: string
  notes?: string
}) {
  const policy = await prisma.countryPolicyVersion.findUnique({
    where: { id: input.policyVersionId },
    include: { gates: true, transitions: true },
  })
  if (!policy) throw Object.assign(new Error('Policy version not found'), { statusCode: 404 })
  if (policy.status !== 'REVIEW' && policy.status !== 'HOLD') {
    throw Object.assign(new Error(`Cannot activate from status ${policy.status}`), { statusCode: 400 })
  }
  if (policy.preparedById && policy.preparedById === input.authorizerId) {
    throw Object.assign(new Error('Separation of duties: same staff cannot prepare and authorize'), {
      statusCode: 403,
    })
  }

  const ready = allGatesReadyForActivation(
    policy.gates.map((g) => ({ code: g.code, status: g.status as GateStatus })),
  )
  if (!ready.ok) {
    throw Object.assign(new Error(`Activation DENY: incomplete gates ${ready.missing.join(', ')}`), {
      statusCode: 400,
      reasonCodes: ready.missing.map((g) => `gate_incomplete:${g}`),
    })
  }

  // Direct status flip without this transition path is invalid to PDS.
  const scopes = defaultFeatureScopesForActivation()
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    // Suspend any prior ACTIVE version for this country.
    await tx.countryPolicyVersion.updateMany({
      where: { countryCode: policy.countryCode, status: 'ACTIVE', id: { not: policy.id } },
      data: { status: 'SUSPENDED', effectiveTo: now },
    })

    const updated = await tx.countryPolicyVersion.update({
      where: { id: policy.id },
      data: {
        status: 'ACTIVE',
        publishedAt: now,
        effectiveFrom: now,
      },
    })

    for (const [action, state] of Object.entries(scopes) as [FeatureScopeAction, FeatureScopeState][]) {
      await tx.countryFeatureScope.upsert({
        where: { policyVersionId_action: { policyVersionId: policy.id, action } },
        create: { policyVersionId: policy.id, action, state },
        update: { state },
      })
    }

    await tx.countryTransition.create({
      data: {
        policyVersionId: policy.id,
        kind: 'activate',
        fromStatus: policy.status,
        toStatus: 'ACTIVE',
        actorId: policy.preparedById ?? input.authorizerId,
        authorizeId: input.authorizerId,
        notes: input.notes ?? null,
        metadata: { gates: COUNTRY_GATE_CODES },
      },
    })

    return updated
  })
}

export async function suspendPolicy(input: {
  policyVersionId: string
  actorId: string
  notes?: string
}) {
  const policy = await prisma.countryPolicyVersion.findUnique({ where: { id: input.policyVersionId } })
  if (!policy) throw Object.assign(new Error('Policy version not found'), { statusCode: 404 })
  if (policy.status !== 'ACTIVE') {
    throw Object.assign(new Error('Only ACTIVE policies can be suspended'), { statusCode: 400 })
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.countryPolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'SUSPENDED', effectiveTo: new Date() },
    })
    await tx.countryFeatureScope.updateMany({
      where: {
        policyVersionId: policy.id,
        action: { in: ['contributor_signup', 'contributor_upload', 'new_license'] },
      },
      data: { state: 'HOLD' },
    })
    await tx.countryTransition.create({
      data: {
        policyVersionId: policy.id,
        kind: 'suspend',
        fromStatus: 'ACTIVE',
        toStatus: 'SUSPENDED',
        actorId: input.actorId,
        notes: input.notes ?? null,
        metadata: {
          effects: {
            contributor_signup: 'HOLD',
            contributor_upload: 'HOLD',
            new_license: 'HOLD',
            historical_licences: 'kept',
            unpaid_balances: 'review_path',
          },
        },
      },
    })
    return updated
  })
}

function featureScopeState(
  policy: NonNullable<Awaited<ReturnType<typeof getActivePolicyVersion>>>,
  action: FeatureScopeAction,
): FeatureScopeState | null {
  const row = policy.featureScopes.find((s) => s.action === action)
  return (row?.state as FeatureScopeState | undefined) ?? null
}

function hasValidActivationTransition(
  policy: NonNullable<Awaited<ReturnType<typeof getActivePolicyVersion>>>,
): boolean {
  return policy.transitions.some((t) => t.kind === 'activate' && t.toStatus === 'ACTIVE')
}

/**
 * Policy Decision Service — fail closed for regulated writes.
 * Direct DB status flips without an activate transition are treated as invalid.
 */
export async function evaluatePolicy(input: PolicyEvaluateInput): Promise<PolicyEvaluateResult> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const action = input.action as PolicyAction
  const countryCode = input.countryCode?.toUpperCase()

  if (!countryCode) {
    return {
      decision: 'DENY',
      reasonCodes: ['country_required'],
      policyVersion: null,
      expiresAt,
      evidenceRequired: [],
    }
  }

  const country = await prisma.country.findUnique({
    where: { code: countryCode },
    include: { legalOverlay: true },
  })
  if (!country || !country.enabled) {
    return {
      decision: 'DENY',
      reasonCodes: ['country_unknown_or_disabled'],
      policyVersion: null,
      expiresAt,
      evidenceRequired: [],
    }
  }

  const overlayAllows = country.legalOverlay ? country.legalOverlay.contributorAllowed : true
  const africaListOk =
    country.region === 'africa' && country.contributorEligible && overlayAllows

  // Nonmember / invited consent is independent of contributor ACTIVE (P0 UAT #3).
  if (action === 'rights.invite') {
    return {
      decision: 'ALLOW',
      reasonCodes: ['rights_invite_independent_of_contributor_active'],
      policyVersion: null,
      expiresAt,
      evidenceRequired: [],
    }
  }

  if (action === 'contributor.create') {
    if (!africaListOk) {
      return {
        decision: 'DENY',
        reasonCodes: ['l1_africa_geo_deny', `country:${countryCode}`],
        policyVersion: null,
        expiresAt,
        evidenceRequired: [],
      }
    }

    const onboarding = await getContributorOnboardingPolicy()
    if (onboarding === 'africa_list') {
      return {
        decision: 'ALLOW',
        reasonCodes: ['africa_list_ok', 'onboarding_policy:africa_list'],
        policyVersion: null,
        expiresAt,
        evidenceRequired: [],
      }
    }

    const active = await getActivePolicyVersion(countryCode)
    if (!active) {
      return {
        decision: 'DENY',
        reasonCodes: ['policy_unavailable', 'no_active_country_policy'],
        policyVersion: null,
        expiresAt,
        evidenceRequired: COUNTRY_GATE_CODES.map((c) => c as CountryGateCode),
      }
    }
    if (!hasValidActivationTransition(active)) {
      return {
        decision: 'DENY',
        reasonCodes: ['policy_invalid_no_transition', 'direct_db_status_flip'],
        policyVersion: `${active.countryCode}:v${active.version}`,
        expiresAt,
        evidenceRequired: [],
      }
    }
    const signup = featureScopeState(active, 'contributor_signup')
    if (signup !== 'ON') {
      return {
        decision: 'DENY',
        reasonCodes: ['feature_scope_hold:contributor_signup', `scope:${signup ?? 'missing'}`],
        policyVersion: `${active.countryCode}:v${active.version}`,
        expiresAt,
        evidenceRequired: [],
      }
    }
    return {
      decision: 'ALLOW',
      reasonCodes: ['africa_list_ok', 'country_policy_active', 'contributor_signup_on'],
      policyVersion: `${active.countryCode}:v${active.version}`,
      expiresAt,
      evidenceRequired: [],
    }
  }

  // Phase 54: license.issue / asset.commercialize — legacy ALLOW when no ACTIVE/SUSPENDED
  // regulatory policy (all markets HOLD today). DENY when a regulating policy holds new_license.
  // payout.authorize stays fail-closed until Dec-PayBase / P1.
  if (action === 'asset.commercialize' || action === 'license.issue') {
    const regulating = await getRegulatingLicensePolicy(countryCode)
    if (!regulating) {
      return {
        decision: 'ALLOW',
        reasonCodes: ['legacy_pass_through_no_active_policy'],
        policyVersion: null,
        expiresAt,
        evidenceRequired: [],
      }
    }
    if (!hasValidActivationTransition(regulating)) {
      return {
        decision: 'DENY',
        reasonCodes: ['policy_invalid_no_transition', 'direct_db_status_flip'],
        policyVersion: `${regulating.countryCode}:v${regulating.version}`,
        expiresAt,
        evidenceRequired: [],
      }
    }
    const state = featureScopeState(regulating, 'new_license')
    if (state !== 'ON') {
      return {
        decision: 'DENY',
        reasonCodes: [
          'feature_scope_not_on:new_license',
          regulating.status === 'SUSPENDED' ? 'market_suspended' : 'new_license_hold',
          `scope:${state ?? 'missing'}`,
        ],
        policyVersion: `${regulating.countryCode}:v${regulating.version}`,
        expiresAt,
        evidenceRequired: [],
      }
    }
    return {
      decision: 'ALLOW',
      reasonCodes: ['new_license_on', `policy_status:${regulating.status}`],
      policyVersion: `${regulating.countryCode}:v${regulating.version}`,
      expiresAt,
      evidenceRequired: [],
    }
  }

  if (action === 'payout.authorize') {
    const active = await getActivePolicyVersion(countryCode)
    if (!active || !hasValidActivationTransition(active)) {
      return {
        decision: 'DENY',
        reasonCodes: ['policy_unavailable', 'payout_fail_closed'],
        policyVersion: active ? `${active.countryCode}:v${active.version}` : null,
        expiresAt,
        evidenceRequired: [],
      }
    }
    const state = featureScopeState(active, 'payouts')
    if (state !== 'ON') {
      return {
        decision: 'DENY',
        reasonCodes: ['feature_scope_not_on:payouts', 'p0_commercial_hold'],
        policyVersion: `${active.countryCode}:v${active.version}`,
        expiresAt,
        evidenceRequired: [],
      }
    }
    return {
      decision: 'REVIEW',
      reasonCodes: ['p1_rights_revenue_pending'],
      policyVersion: `${active.countryCode}:v${active.version}`,
      expiresAt,
      evidenceRequired: [],
    }
  }

  return {
    decision: 'DENY',
    reasonCodes: ['unknown_action'],
    policyVersion: null,
    expiresAt,
    evidenceRequired: [],
  }
}

/** Assert new licenses allowed via PDS for the photograph's contributor market. */
export async function assertNewLicenseAllowed(countryCode?: string | null) {
  if (!countryCode?.trim()) return
  const result = await evaluatePolicy({
    action: 'license.issue',
    countryCode,
  })
  if (result.decision !== 'ALLOW') {
    const suspended = result.reasonCodes.includes('market_suspended')
    throw Object.assign(
      new Error(
        suspended
          ? 'New licensing is suspended for this market. Existing certificates are not revoked.'
          : `New licensing is not available for this market (${result.reasonCodes.join(', ')})`,
      ),
      {
        statusCode: 403,
        reasonCodes: result.reasonCodes,
        policyVersion: result.policyVersion,
      },
    )
  }
}

/** Assert contributor country via PDS; throws Fastify-style errors. */
export async function assertContributorCountryViaPds(countryCode?: string) {
  if (!countryCode) {
    throw Object.assign(new Error('Contributors must select an African country'), { statusCode: 400 })
  }
  const result = await evaluatePolicy({
    action: 'contributor.create',
    countryCode,
  })
  if (result.decision !== 'ALLOW') {
    const msg =
      result.reasonCodes.includes('l1_africa_geo_deny') ||
      result.reasonCodes.includes('country_unknown_or_disabled')
        ? 'Vuekumi only accepts contributors from African countries'
        : `Contributor onboarding denied (${result.reasonCodes.join(', ')})`
    throw Object.assign(new Error(msg), {
      statusCode: 400,
      reasonCodes: result.reasonCodes,
      policyVersion: result.policyVersion,
    })
  }
  const country = await prisma.country.findUnique({
    where: { code: countryCode.toUpperCase() },
    include: { legalOverlay: true },
  })
  if (!country) {
    throw Object.assign(new Error('Vuekumi only accepts contributors from African countries'), {
      statusCode: 400,
    })
  }
  return country
}
