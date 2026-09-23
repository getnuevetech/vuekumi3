import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { prisma } from './prisma.js'

function encryptionKey(): Buffer {
  // Deliberately does not fall back to JWT_SECRET/COOKIE_SECRET: those sign sessions,
  // this encrypts stored payment/API credentials — a JWT-secret leak must not also
  // decrypt every Stripe/Flutterwave/OpenAI/S3 key. assertProductionSecrets() refuses
  // to boot in production without a distinct SETTINGS_ENCRYPTION_KEY.
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || 'dev-only-settings-key-do-not-use-in-production'
  return scryptSync(secret, 'vuekumi-settings', 32)
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith('enc:')) return stored
  const parts = stored.split(':')
  if (parts.length !== 4) return stored
  const [, ivHex, tagHex, dataHex] = parts
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}

export function maskSecret(value: string): string {
  if (!value) return ''
  if (value.length <= 4) return '••••'
  return `••••••••${value.slice(-4)}`
}

export interface SettingDefinition {
  key: string
  label: string
  group: string
  secret: boolean
  placeholder?: string
  envFallback?: string
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  { key: 'payments.stripe.secret_key', label: 'Stripe secret key', group: 'Payments — Stripe', secret: true, envFallback: 'STRIPE_SECRET_KEY' },
  { key: 'payments.stripe.publishable_key', label: 'Stripe publishable key', group: 'Payments — Stripe', secret: false },
  { key: 'payments.stripe.webhook_secret', label: 'Stripe webhook secret', group: 'Payments — Stripe', secret: true, envFallback: 'STRIPE_WEBHOOK_SECRET' },
  { key: 'payments.flutterwave.secret_key', label: 'Flutterwave secret key', group: 'Payments — Flutterwave', secret: true, envFallback: 'FLUTTERWAVE_SECRET_KEY' },
  { key: 'payments.flutterwave.public_key', label: 'Flutterwave public key', group: 'Payments — Flutterwave', secret: false },
  { key: 'payments.flutterwave.secret_hash', label: 'Flutterwave webhook hash', group: 'Payments — Flutterwave', secret: true, envFallback: 'FLUTTERWAVE_SECRET_HASH' },
  { key: 'payments.contributor_share', label: 'Contributor share (0–1, default 0.5)', group: 'Payments', secret: false, placeholder: '0.5' },
  { key: 'email.resend_api_key', label: 'Resend API key', group: 'Email', secret: true, envFallback: 'RESEND_API_KEY' },
  { key: 'email.from_address', label: 'From email address', group: 'Email', secret: false, placeholder: 'Vuekumi <hello@yourdomain.com>' },
  { key: 'email.ops_address', label: 'Ops inbox for quote alerts', group: 'Email', secret: false, placeholder: 'ops@vuekumi.com' },
  { key: 'dmca.agent_name', label: 'DMCA designated agent name', group: 'DMCA', secret: false, placeholder: 'VueKumi DMCA Agent' },
  { key: 'dmca.agent_address', label: 'DMCA designated agent address', group: 'DMCA', secret: false, placeholder: 'Street, city, state, ZIP, country' },
  { key: 'dmca.agent_email', label: 'DMCA designated agent email', group: 'DMCA', secret: false, placeholder: 'dmca@vuekumi.com' },
  { key: 'dmca.agent_phone', label: 'DMCA designated agent phone', group: 'DMCA', secret: false, placeholder: '+1 …' },
  { key: 'dmca.repeat_infringer_threshold', label: 'Repeat-infringer strike threshold', group: 'DMCA', secret: false, placeholder: '3' },
  { key: 'dmca.counter_wait_days', label: 'Counter-notice wait (business days)', group: 'DMCA', secret: false, placeholder: '14' },
  { key: 'payouts.new_seller_hold_days', label: 'New-seller payout hold (days)', group: 'Payouts', secret: false, placeholder: '14' },
  { key: 'payouts.high_value_hold_usd', label: 'High-value grant hold threshold (USD)', group: 'Payouts', secret: false, placeholder: '500' },
  { key: 'ai.openai_api_key', label: 'OpenAI API key', group: 'AI', secret: true, envFallback: 'OPENAI_API_KEY' },
  { key: 'ai.openai_model', label: 'OpenAI vision model', group: 'AI', secret: false, placeholder: 'gpt-4o-mini' },
  { key: 'ai.replicate_api_token', label: 'Replicate API token', group: 'AI', secret: true, envFallback: 'REPLICATE_API_TOKEN' },
  { key: 'storage.s3_endpoint', label: 'Object storage endpoint', group: 'Storage', secret: false, placeholder: 'https://s3.amazonaws.com or Lightsail / MinIO endpoint', envFallback: 'S3_ENDPOINT' },
  { key: 'storage.s3_region', label: 'Object storage region', group: 'Storage', secret: false, envFallback: 'S3_REGION' },
  { key: 'storage.s3_bucket', label: 'Bucket name', group: 'Storage', secret: false, envFallback: 'S3_BUCKET' },
  { key: 'storage.s3_access_key', label: 'Access key', group: 'Storage', secret: true, envFallback: 'S3_ACCESS_KEY' },
  { key: 'storage.s3_secret_key', label: 'Secret key', group: 'Storage', secret: true, envFallback: 'S3_SECRET_KEY' },
  { key: 'auth.google_client_id', label: 'Google OAuth client ID', group: 'Auth — Google', secret: false, envFallback: 'GOOGLE_CLIENT_ID', placeholder: 'xxxx.apps.googleusercontent.com' },
  { key: 'auth.google_client_secret', label: 'Google OAuth client secret', group: 'Auth — Google', secret: true, envFallback: 'GOOGLE_CLIENT_SECRET' },
  { key: 'ops.sentry_dsn', label: 'Sentry DSN', group: 'Observability', secret: false, envFallback: 'SENTRY_DSN', placeholder: 'https://...@....ingest.sentry.io/...' },
  {
    key: 'geo.contributor_onboarding_policy',
    label: 'Contributor onboarding policy (africa_list | africa_list_and_country_active)',
    group: 'Geo / Country policy',
    secret: false,
    placeholder: 'africa_list',
  },
  {
    key: 'moderation.ai_auto_approve_accounts',
    label: 'AI auto-approve new creator accounts (true/false)',
    group: 'Moderation',
    secret: false,
    placeholder: 'true',
  },
  {
    key: 'moderation.ai_auto_approve_content',
    label: 'AI auto-approve new photo uploads (true/false)',
    group: 'Moderation',
    secret: false,
    placeholder: 'true',
  },
  {
    key: 'moderation.disposable_email_domains',
    label: 'Blocked email domains for new accounts (comma-separated; sends to manual review, never blocks)',
    group: 'Moderation',
    secret: false,
    placeholder: 'mailinator.com,10minutemail.com,guerrillamail.com',
  },
  {
    key: 'moderation.require_complete_metadata',
    label: 'Require title/category/country before auto-approving an upload (true/false)',
    group: 'Moderation',
    secret: false,
    placeholder: 'true',
  },
  {
    key: 'moderation.min_photo_width',
    label: 'Minimum photo width (px) to auto-approve',
    group: 'Moderation',
    secret: false,
    placeholder: '800',
  },
  {
    key: 'moderation.min_photo_height',
    label: 'Minimum photo height (px) to auto-approve',
    group: 'Moderation',
    secret: false,
    placeholder: '600',
  },
]

export function envSetting(key: string): string | null {
  const def = SETTING_DEFINITIONS.find((d) => d.key === key)
  if (def?.envFallback && process.env[def.envFallback]) {
    return process.env[def.envFallback] ?? null
  }
  return null
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } })
  if (row?.value) {
    return row.secret ? decryptSecret(row.value) : row.value
  }
  return envSetting(key)
}

export async function getSettingSafe(key: string): Promise<string | null> {
  try {
    return await getSetting(key)
  } catch {
    return envSetting(key)
  }
}

export async function listSettingsForAdmin() {
  const rows = await prisma.platformSetting.findMany()
  const byKey = new Map(rows.map((r) => [r.key, r]))

  return SETTING_DEFINITIONS.map((def) => {
    const row = byKey.get(def.key)
    let configured = false
    let displayValue = ''
    if (row?.value) {
      configured = true
      const plain = row.secret ? decryptSecret(row.value) : row.value
      displayValue = def.secret ? maskSecret(plain) : plain
    } else if (def.envFallback && process.env[def.envFallback]) {
      configured = true
      displayValue = def.secret ? maskSecret(process.env[def.envFallback]!) : process.env[def.envFallback]!
    }
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      secret: def.secret,
      placeholder: def.placeholder,
      configured,
      value: def.secret ? '' : displayValue,
      masked: def.secret ? displayValue : undefined,
    }
  })
}

export async function upsertSetting(key: string, value: string, actorId?: string) {
  const def = SETTING_DEFINITIONS.find((d) => d.key === key)
  if (!def) throw new Error(`Unknown setting: ${key}`)
  if (def.secret && !value.trim()) return

  await prisma.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value: def.secret ? encryptSecret(value) : value,
      secret: def.secret,
      label: def.label,
      group: def.group,
      updatedBy: actorId,
    },
    update: {
      value: def.secret ? encryptSecret(value) : value,
      secret: def.secret,
      updatedBy: actorId,
    },
  })
}
