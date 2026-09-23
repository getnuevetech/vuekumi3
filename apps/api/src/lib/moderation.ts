import { getSetting } from './settings.js'

/**
 * Phase 61 — AI-assisted account & content approval.
 *
 * This is an ADDITIVE signal alongside — never instead of — the checks that
 * already own their domains: Phase 49's PDS country-eligibility gate and the
 * Dec-Bio-gated identity check (Phase 60). It never decides country
 * eligibility or identity, and it never produces an unappealable DENY —
 * "not auto-approved" always means "falls back to today's human review,"
 * the same `pending` state that existed before this phase.
 */

const DEFAULT_DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'yopmail.com',
  'trashmail.com',
  'discard.email',
  'throwawaymail.com',
]

async function settingBool(key: string, fallback: boolean): Promise<boolean> {
  const raw = await getSetting(key)
  if (raw == null || raw.trim() === '') return fallback
  return !['false', '0', 'off', 'no'].includes(raw.trim().toLowerCase())
}

async function settingNumber(key: string, fallback: number): Promise<number> {
  const raw = await getSetting(key)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export type ApprovalDecision = { decision: 'active' | 'pending'; reasons: string[] }

/**
 * Non-biometric, non-country signal only. Never touches Phase 49's country
 * gate or a future Phase 60 identity check — those already own their own
 * ALLOW/DENY paths and run before or independently of this.
 */
export async function evaluateAccountApproval(input: { email: string }): Promise<ApprovalDecision> {
  const domain = input.email.split('@')[1]?.trim().toLowerCase() ?? ''
  const listRaw = await getSetting('moderation.disposable_email_domains')
  const list = (listRaw ? listRaw.split(',') : DEFAULT_DISPOSABLE_EMAIL_DOMAINS)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  if (domain && list.includes(domain)) {
    return { decision: 'pending', reasons: [`disposable_email_domain:${domain}`] }
  }

  const autoApprove = await settingBool('moderation.ai_auto_approve_accounts', true)
  if (!autoApprove) return { decision: 'pending', reasons: ['auto_approve_disabled'] }

  return { decision: 'active', reasons: ['clean_signup'] }
}

/**
 * Safety-floor screening flags (possible minor, potentially sensitive,
 * uncertain detection) ALWAYS force manual review regardless of the
 * auto-approve toggle — these are not exposed as a togglable criterion, so
 * an admin cannot accidentally disable them by flipping the general switch.
 */
export async function evaluateContentApproval(input: {
  screening: {
    possibleMinor: boolean
    potentiallySensitive: boolean
    uncertainHumanDetection: boolean
  }
  title?: string | null
  category?: string | null
  country?: string | null
  width?: number | null
  height?: number | null
}): Promise<ApprovalDecision> {
  if (input.screening.possibleMinor) return { decision: 'pending', reasons: ['possible_minor'] }
  if (input.screening.potentiallySensitive) return { decision: 'pending', reasons: ['potentially_sensitive'] }
  if (input.screening.uncertainHumanDetection) {
    return { decision: 'pending', reasons: ['uncertain_human_detection'] }
  }

  const autoApprove = await settingBool('moderation.ai_auto_approve_content', true)
  if (!autoApprove) return { decision: 'pending', reasons: ['auto_approve_disabled'] }

  const reasons: string[] = []
  const requireMetadata = await settingBool('moderation.require_complete_metadata', true)
  if (requireMetadata && (!input.title?.trim() || !input.category?.trim() || !input.country?.trim())) {
    reasons.push('incomplete_metadata')
  }

  const minWidth = await settingNumber('moderation.min_photo_width', 800)
  const minHeight = await settingNumber('moderation.min_photo_height', 600)
  if (typeof input.width === 'number' && input.width < minWidth) {
    reasons.push(`width_below_minimum:${input.width}<${minWidth}`)
  }
  if (typeof input.height === 'number' && input.height < minHeight) {
    reasons.push(`height_below_minimum:${input.height}<${minHeight}`)
  }

  if (reasons.length > 0) return { decision: 'pending', reasons }
  return { decision: 'active', reasons: ['clean_upload'] }
}
