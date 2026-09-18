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

export function photographerRightsNoticeEmail(input: {
  displayName: string
  modelName: string
  photoTitle: string
  link: string
}): string {
  return `<p>Hi ${input.displayName},</p><p>A model on VueKumi identified you as the photographer or copyright holder of a photograph they uploaded. This message is for <strong>rights clearance only</strong> — it is not a marketing list. ${input.modelName} supplied your contact solely so VueKumi can confirm copyright. VueKumi will name who supplied this contact.</p><p><strong>${input.modelName}</strong> uploaded <strong>${input.photoTitle}</strong> and named you.</p><p>You can authorize display on VueKumi, authorize commercial sublicensing through VueKumi, reject the request, say this is not you, or report an unauthorized submission. You do not need a VueKumi account to decide. A typed name is not identity, and a checkbox is not consent.</p><p>Vuekumi sells usage permission, not ownership. Display permission is not commercial licensing. AI-training is a separate opt-in and is not requested by this notice.</p><p><a href="${input.link}">${input.link}</a></p><p>This link expires in 14 days. Your contact details stay private.</p>`
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
  return `<p>Hi ${input.displayName},</p><p><strong>${input.photographerName}</strong> identified you in photographs uploaded to VueKumi. This contact was provided only for rights clearance. It is not a marketing list. VueKumi names the supplier of the contact: ${input.photographerName}.</p><p>They identified you in <strong>${input.photoTitle}</strong>${count}.${shoot}</p><p>Review the images and decide whether you authorize their use. You do not need a VueKumi account first. A typed name is not identity, and a checkbox is not consent.</p><p>You can approve, reject, report that this is not you, or report an unauthorized or misleading submission. You can later withdraw consent: new licensing stops; existing certificates are not silently voided. Contest a past grant with a rights report.</p><p>Vuekumi sells usage permission, not ownership. Models do not earn from licences. Your contact details stay private.</p><p><a href="${input.link}">${input.link}</a></p><p>This link expires in 14 days.</p>`
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

export function bookingRequestEmail(input: {
  name: string
  requesterName: string
  title: string
  bookingsUrl: string
}): string {
  return `<p>Hi ${input.name},</p><p><strong>${input.requesterName}</strong> sent you a booking request on Vuekumi: <strong>${input.title}</strong>.</p><p>Quote it or decline it from your bookings page. Vuekumi records the agreement; payment is settled directly between you, and Vuekumi charges no booking fee in this phase.</p><p><a href="${input.bookingsUrl}">${input.bookingsUrl}</a></p>`
}

export function bookingQuotedEmail(input: {
  name: string
  targetName: string
  title: string
  quoteUsd: number
  bookingsUrl: string
}): string {
  return `<p>Hi ${input.name},</p><p><strong>${input.targetName}</strong> quoted USD ${input.quoteUsd.toFixed(2)} for <strong>${input.title}</strong>.</p><p>Accept or withdraw from your bookings page. Payment is settled directly between you — Vuekumi charges no booking fee in this phase.</p><p><a href="${input.bookingsUrl}">${input.bookingsUrl}</a></p>`
}

export function bookingDecisionEmail(input: {
  name: string
  otherName: string
  title: string
  decision: 'accepted' | 'declined' | 'withdrawn'
  bookingsUrl: string
}): string {
  return `<p>Hi ${input.name},</p><p><strong>${input.otherName}</strong> ${input.decision} the booking <strong>${input.title}</strong>.</p><p><a href="${input.bookingsUrl}">${input.bookingsUrl}</a></p>`
}

export function campaignPitchEmail(input: {
  name: string
  contributorName: string
  campaignTitle: string
  campaignsUrl: string
}): string {
  return `<p>Hi ${input.name},</p><p><strong>${input.contributorName}</strong> pitched your campaign <strong>${input.campaignTitle}</strong> on Vuekumi.</p><p>Review pitches on your campaigns page. Vuekumi records the brief, the pitches, and your decision — production payment is settled directly between you, and Vuekumi charges no production fee in this phase.</p><p><a href="${input.campaignsUrl}">${input.campaignsUrl}</a></p>`
}

export function pitchDecisionEmail(input: {
  name: string
  ownerName: string
  campaignTitle: string
  decision: 'accepted' | 'declined'
  campaignsUrl: string
}): string {
  const extra =
    input.decision === 'accepted'
      ? '<p>Settle production terms and payment directly with the brand — Vuekumi charges no production fee in this phase. Any photograph you licence afterwards still goes through normal Vuekumi checkout with all rights checks.</p>'
      : ''
  return `<p>Hi ${input.name},</p><p><strong>${input.ownerName}</strong> ${input.decision} your pitch for <strong>${input.campaignTitle}</strong>.</p>${extra}<p><a href="${input.campaignsUrl}">${input.campaignsUrl}</a></p>`
}

export function representationRequestOpsEmail(input: {
  contributorName: string
  contributorEmail: string
  note: string | null
  queueUrl: string
}): string {
  const note = input.note ? `<p>Note: ${input.note}</p>` : ''
  return `<p><strong>${input.contributorName}</strong> (${input.contributorEmail}) requested VueQuatro representation.</p>${note}<p>Representation is opt-in and does not transfer copyright. No commission rate exists — do not invent one.</p><p><a href="${input.queueUrl}">${input.queueUrl}</a></p>`
}

export function representationDecisionEmail(input: {
  name: string
  decision: 'approved' | 'declined' | 'ended'
  staffNote: string | null
  dashboardUrl: string
}): string {
  const note = input.staffNote ? `<p>Staff note: ${input.staffNote}</p>` : ''
  const body =
    input.decision === 'approved'
      ? '<p>VueQuatro now represents your work. Staff can mark photographs as agency-protected: they leave self-serve stock and buyers inquire through Vuekumi instead. You keep copyright, and you can end representation at any time.</p>'
      : input.decision === 'declined'
        ? '<p>Your VueQuatro representation request was declined. Nothing changes about your account, your photographs, or your earnings. You can request again later.</p>'
        : '<p>Your VueQuatro representation has ended. Any agency-protected photographs have been returned to you as portfolio-only — you can re-licence them from your photo editor as usual.</p>'
  return `<p>Hi ${input.name},</p>${body}${note}<p><a href="${input.dashboardUrl}">${input.dashboardUrl}</a></p>`
}

export function representationInquiryOpsEmail(input: {
  photoTitle: string
  name: string
  email: string
  company: string | null
  message: string
  queueUrl: string
}): string {
  const company = input.company ? ` (${input.company})` : ''
  return `<p>An agency-protected licensing inquiry arrived.</p><p><strong>${input.photoTitle}</strong></p><p>From: ${input.name}${company} · ${input.email}</p><p>${input.message}</p><p>Agency-protected inventory is not self-serve stock. Vuekumi sells usage permission, not ownership.</p><p><a href="${input.queueUrl}">${input.queueUrl}</a></p>`
}

export function rightsReportOpsEmail(input: {
  photoTitle: string
  reason: string
  reporterEmail: string
  queueUrl: string
}): string {
  return `<p>A public rights report was filed.</p><p><strong>${input.photoTitle}</strong></p><p>Reason: ${input.reason}</p><p>Reporter: ${input.reporterEmail}</p><p>Staff can freeze new licensing without delisting the photograph.</p><p><a href="${input.queueUrl}">${input.queueUrl}</a></p>`
}

export function dmcaNoticeOpsEmail(input: {
  photoTitle: string
  claimantEmail: string
  queueUrl: string
}): string {
  return `<p>A DMCA copyright notice was filed. Someone needs to read it.</p><p><strong>${input.photoTitle}</strong></p><p>Claimant: ${input.claimantEmail}</p><p>DMCA is copyright only. Likeness and privacy complaints stay on the rights-report queue.</p><p>New licensing on the named photograph is frozen. Unpaid earnings are held. This does not revoke existing certificates.</p><p><a href="${input.queueUrl}">${input.queueUrl}</a></p>`
}
