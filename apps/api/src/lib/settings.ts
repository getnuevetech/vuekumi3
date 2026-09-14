import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { prisma } from './prisma.js'

function encryptionKey(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-settings-key'
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
  { key: 'ai.openai_api_key', label: 'OpenAI API key', group: 'AI', secret: true, envFallback: 'OPENAI_API_KEY' },
  { key: 'ai.openai_model', label: 'OpenAI vision model', group: 'AI', secret: false, placeholder: 'gpt-4o-mini' },
  { key: 'ai.replicate_api_token', label: 'Replicate API token', group: 'AI', secret: true, envFallback: 'REPLICATE_API_TOKEN' },
  { key: 'storage.s3_endpoint', label: 'Object storage endpoint', group: 'Storage', secret: false, placeholder: 'https://s3.amazonaws.com or Lightsail / MinIO endpoint', envFallback: 'S3_ENDPOINT' },
  { key: 'storage.s3_region', label: 'Object storage region', group: 'Storage', secret: false, envFallback: 'S3_REGION' },
  { key: 'storage.s3_bucket', label: 'Bucket name', group: 'Storage', secret: false, envFallback: 'S3_BUCKET' },
  { key: 'storage.s3_access_key', label: 'Access key', group: 'Storage', secret: true, envFallback: 'S3_ACCESS_KEY' },
  { key: 'storage.s3_secret_key', label: 'Secret key', group: 'Storage', secret: true, envFallback: 'S3_SECRET_KEY' },
]

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } })
  if (row?.value) {
    return row.secret ? decryptSecret(row.value) : row.value
  }
  const def = SETTING_DEFINITIONS.find((d) => d.key === key)
  if (def?.envFallback && process.env[def.envFallback]) {
    return process.env[def.envFallback] ?? null
  }
  return null
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
