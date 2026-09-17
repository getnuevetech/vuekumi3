import { config } from '../config.js'
import { captureException } from './sentry.js'
import { getSettingSafe } from './settings.js'

export interface EmailPayload {
  to: string
  subject: string
  html: string
}

export type SendEmailResult =
  | { status: 'sent'; id: string }
  | { status: 'skipped'; reason: 'not_configured' }
  | { status: 'failed'; error: string }

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
export const DEFAULT_FROM_ADDRESS = 'Vuekumi <hello@vuekumi.com>'

export function resendKeyReady(key: string | null | undefined): boolean {
  return Boolean(key && key.startsWith('re_') && key.length > 8)
}

export function htmlToText(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>/gi, '$1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function postResendEmail(
  apiKey: string,
  body: { from: string; to: string; subject: string; html: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const res = await fetchImpl(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: body.from,
      to: [body.to],
      subject: body.subject,
      html: body.html,
      text: body.text,
    }),
  })
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!res.ok) {
    return { ok: false, status: res.status, error: json.message || `Resend HTTP ${res.status}` }
  }
  return { ok: true, id: json.id ?? '' }
}

export async function loadEmailConfig(): Promise<{ apiKey: string | null; from: string }> {
  const [apiKey, from] = await Promise.all([
    getSettingSafe('email.resend_api_key'),
    getSettingSafe('email.from_address'),
  ])
  return {
    apiKey: apiKey?.trim() || null,
    from: from?.trim() || DEFAULT_FROM_ADDRESS,
  }
}

/** Deliver through Resend when Admin Settings (or env fallback) has a key. Never throws. */
export async function sendEmail(
  payload: EmailPayload,
  deps: { fetchImpl?: typeof fetch; apiKey?: string | null; from?: string } = {},
): Promise<SendEmailResult> {
  if (config.isDev) {
    console.log('[email]', payload.subject, '→', payload.to)
    console.log(payload.html)
  }

  const loaded =
    deps.apiKey === undefined
      ? await loadEmailConfig()
      : { apiKey: deps.apiKey, from: deps.from ?? DEFAULT_FROM_ADDRESS }
  const apiKey = loaded.apiKey
  const from = deps.from ?? loaded.from

  if (!resendKeyReady(apiKey)) {
    if (!config.isDev) {
      console.warn('[email] Resend is not configured; message not delivered', payload.subject, '→', payload.to)
    }
    return { status: 'skipped', reason: 'not_configured' }
  }

  try {
    const result = await postResendEmail(
      apiKey!,
      {
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: htmlToText(payload.html),
      },
      deps.fetchImpl ?? fetch,
    )
    if (!result.ok) {
      console.error('[email] Resend rejected', result.error)
      captureException(new Error(result.error))
      return { status: 'failed', error: result.error }
    }
    return { status: 'sent', id: result.id }
  } catch (err) {
    captureException(err)
    const error = err instanceof Error ? err.message : 'Resend request failed'
    console.error('[email] Resend request failed', error)
    return { status: 'failed', error }
  }
}

export function passwordResetEmail(name: string, link: string): string {
  return `<p>Hi ${name},</p><p>Reset your Vuekumi password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`
}

export function verifyEmail(name: string, link: string): string {
  return `<p>Hi ${name},</p><p>Verify your Vuekumi email:</p><p><a href="${link}">${link}</a></p>`
}

export function adminPasswordResetEmail(name: string, link: string): string {
  return `<p>Hi ${name},</p><p>A Vuekumi administrator has requested a password reset for your account.</p><p><a href="${link}">${link}</a></p>`
}

export function agencyInviteEmail(agencyName: string, role: string, link: string): string {
  return `<p>You have been invited to join <strong>${agencyName}</strong> on Vuekumi as ${role}.</p><p>Accept the invite:</p><p><a href="${link}">${link}</a></p><p>This link expires in 14 days. Vuekumi sells usage permission, not ownership.</p>`
}

export function modelInviteEmail(input: {
  displayName: string
  photographerName: string
  photoTitle: string
  link: string
  imageCount?: number
  shootTitle?: string | null
}): string {
  const shoot = input.shootTitle ? ` Shoot: ${input.shootTitle}.` : ''
  const count = input.imageCount && input.imageCount > 1 ? ` (${input.imageCount} photographs)` : ''
  return `<p>Hi ${input.displayName},</p><p>A photographer has identified you in photographs uploaded to VueKumi.</p><p><strong>${input.photographerName}</strong> identified you in <strong>${input.photoTitle}</strong>${count}.${shoot}</p><p>Review the images and decide whether you authorize their use. You do not need a VueKumi account first. A typed name is not identity, and a checkbox is not consent.</p><p>You can approve, reject, report that this is not you, or report an unauthorized or misleading submission.</p><p>Vuekumi sells usage permission, not ownership. Models do not earn from licences. Your contact details stay private.</p><p><a href="${input.link}">${input.link}</a></p><p>This link expires in 14 days.</p>`
}

export function modelReleaseConfirmEmail(input: {
  displayName: string
  photographerName: string
  photoTitle: string
  link: string
}): string {
  return `<p>Hi ${input.displayName},</p><p>A model release bearing your name has been submitted for photographs uploaded to VueKumi by <strong>${input.photographerName}</strong>, including <strong>${input.photoTitle}</strong>.</p><p>A photographer-provided PDF is not automatically verified. Confirm whether the release is yours and whether you authorize those images.</p><p><a href="${input.link}">${input.link}</a></p>`
}

export function testEmailHtml(): string {
  return `<p>Resend is configured on Vuekumi.</p><p>Verification, password reset, and agency invites will send through this key.</p>`
}

export const DEFAULT_OPS_ADDRESS = 'admin@vuekumi.com'

export function quoteRequestOpsEmail(input: {
  photoTitle: string
  requesterEmail: string
  territory: string
  duration: string
  channels: string
  notes?: string | null
  queueUrl: string
}): string {
  const notes = input.notes ? `<p>Notes: ${input.notes}</p>` : ''
  return `<p>A rights-managed quote was requested.</p><p><strong>${input.photoTitle}</strong></p><p>${input.territory} · ${input.duration} · ${input.channels}</p><p>Requester: ${input.requesterEmail}</p>${notes}<p>Vuekumi sells usage permission, not ownership.</p><p><a href="${input.queueUrl}">${input.queueUrl}</a></p>`
}

export function quotePricedEmail(input: {
  name: string
  photoTitle: string
  amountUsd: number
  licensesUrl: string
}): string {
  const amount = input.amountUsd.toFixed(2)
  return `<p>Hi ${input.name},</p><p>Vuekumi priced your rights-managed request for <strong>${input.photoTitle}</strong> at USD ${amount}.</p><p>This is usage permission, not ownership. Review and accept:</p><p><a href="${input.licensesUrl}">${input.licensesUrl}</a></p>`
}

export function rightsReportOpsEmail(input: {
  photoTitle: string
  reason: string
  reporterEmail: string
  queueUrl: string
}): string {
  return `<p>A public rights report was filed.</p><p><strong>${input.photoTitle}</strong></p><p>Reason: ${input.reason}</p><p>Reporter: ${input.reporterEmail}</p><p>Staff can freeze new licensing without delisting the photograph.</p><p><a href="${input.queueUrl}">${input.queueUrl}</a></p>`
}
