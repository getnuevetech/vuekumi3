import { z } from 'zod'

/** Eng-spec §4 canonical gate codes (G01–G16). */
export const COUNTRY_GATE_CODES = [
  'G01',
  'G02',
  'G03',
  'G04',
  'G05',
  'G06',
  'G07',
  'G08',
  'G09',
  'G10',
  'G11',
  'G12',
  'G13',
  'G14',
  'G15',
  'G16',
] as const
export type CountryGateCode = (typeof COUNTRY_GATE_CODES)[number]

export const COUNTRY_GATE_TITLES: Record<CountryGateCode, string> = {
  G01: 'Scope / business model + local counsel assignment',
  G02: 'Copyright ownership / commissioning / assignment',
  G03: 'Likeness / privacy / publicity / model release',
  G04: 'E-signatures + admissible consent evidence',
  G05: 'Data-protection law + extraterritorial reach',
  G06: 'Registrations / local representative / permits',
  G07: 'International transfers / U.S. hosting',
  G08: 'Government-ID checks: law + vendor availability',
  G09: 'Facial/biometric verification: lawful basis + deletion',
  G10: 'Minors / guardians / child compensation',
  G11: 'Tax characterization / withholding / reporting',
  G12: 'Payment rails / currencies / local licensing',
  G13: 'Sanctions / beneficial ownership / payment restrictions',
  G14: 'Complaints / consumer / accessibility / language',
  G15: 'Retention / security / incident response',
  G16: 'Final contracts + approved SOP + counsel + operational sign-off',
}

export const COUNTRY_POLICY_STATUSES = [
  'HOLD',
  'REVIEW',
  'ACTIVE',
  'SUSPENDED',
  'OFFBOARDING',
] as const
export const countryPolicyStatusSchema = z.enum(COUNTRY_POLICY_STATUSES)
export type CountryPolicyStatus = z.infer<typeof countryPolicyStatusSchema>

export const GATE_STATUSES = [
  'NOT_STARTED',
  'RESEARCHING',
  'BLOCKED',
  'APPROVED',
  'NOT_APPLICABLE',
] as const
export const gateStatusSchema = z.enum(GATE_STATUSES)
export type GateStatus = z.infer<typeof gateStatusSchema>

export const FEATURE_SCOPE_ACTIONS = [
  'contributor_signup',
  'contributor_upload',
  'new_license',
  'payouts',
  'biometric_match',
  'minor_program',
  'nonmember_consent',
] as const
export const featureScopeActionSchema = z.enum(FEATURE_SCOPE_ACTIONS)
export type FeatureScopeAction = z.infer<typeof featureScopeActionSchema>

export const FEATURE_SCOPE_STATES = ['ON', 'HOLD', 'CONDITIONAL'] as const
export const featureScopeStateSchema = z.enum(FEATURE_SCOPE_STATES)
export type FeatureScopeState = z.infer<typeof featureScopeStateSchema>

export const POLICY_ACTIONS = [
  'contributor.create',
  'contributor.upload',
  'rights.invite',
  'asset.commercialize',
  'license.issue',
  'payout.authorize',
] as const
export const policyActionSchema = z.enum(POLICY_ACTIONS)
export type PolicyAction = z.infer<typeof policyActionSchema>

export const POLICY_DECISIONS = ['ALLOW', 'DENY', 'REVIEW'] as const
export const policyDecisionSchema = z.enum(POLICY_DECISIONS)
export type PolicyDecision = z.infer<typeof policyDecisionSchema>

export const CONTRIBUTOR_ONBOARDING_POLICIES = [
  'africa_list',
  'africa_list_and_country_active',
] as const
export const contributorOnboardingPolicySchema = z.enum(CONTRIBUTOR_ONBOARDING_POLICIES)
export type ContributorOnboardingPolicy = z.infer<typeof contributorOnboardingPolicySchema>

/** Default until product flips after pilot ACTIVE countries (docs/07 §6.1). */
export const DEFAULT_CONTRIBUTOR_ONBOARDING_POLICY: ContributorOnboardingPolicy = 'africa_list'

export const COUNTRY_TRANSITION_KINDS = [
  'draft',
  'submit_review',
  'activate',
  'suspend',
  'resume',
  'offboard',
  'hold',
] as const
export const countryTransitionKindSchema = z.enum(COUNTRY_TRANSITION_KINDS)
export type CountryTransitionKind = z.infer<typeof countryTransitionKindSchema>

export const policyEvaluateInputSchema = z.object({
  action: policyActionSchema,
  countryCode: z.string().length(2).transform((s) => s.toUpperCase()).optional(),
  actorId: z.string().optional(),
  role: z.string().optional(),
  assetId: z.string().optional(),
  payeeId: z.string().optional(),
  buyerId: z.string().optional(),
  licenseUse: z.string().optional(),
  eventTime: z.string().datetime().optional(),
})
export type PolicyEvaluateInput = z.infer<typeof policyEvaluateInputSchema>

export interface PolicyEvaluateResult {
  decision: PolicyDecision
  reasonCodes: string[]
  policyVersion: string | null
  expiresAt: string | null
  evidenceRequired: string[]
}

export function gateSatisfiedForActivation(status: GateStatus): boolean {
  return status === 'APPROVED' || status === 'NOT_APPLICABLE'
}

export function allGatesReadyForActivation(
  gates: ReadonlyArray<{ code: string; status: GateStatus }>,
): { ok: true } | { ok: false; missing: string[] } {
  const byCode = new Map(gates.map((g) => [g.code, g.status]))
  const missing: string[] = []
  for (const code of COUNTRY_GATE_CODES) {
    const status = byCode.get(code)
    if (!status || !gateSatisfiedForActivation(status)) {
      missing.push(code)
    }
  }
  return missing.length ? { ok: false, missing } : { ok: true }
}

export function defaultFeatureScopesForActivation(): Record<FeatureScopeAction, FeatureScopeState> {
  return {
    contributor_signup: 'ON',
    contributor_upload: 'ON',
    new_license: 'HOLD',
    payouts: 'HOLD',
    biometric_match: 'HOLD',
    minor_program: 'HOLD',
    nonmember_consent: 'ON',
  }
}
