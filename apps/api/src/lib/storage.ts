import { createHmac, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config.js'
import { getSetting } from './settings.js'

const LOCAL_ROOT = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), 'storage'))
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
])

export { MAX_UPLOAD_BYTES }

export type StorageConfig =
  | { driver: 'local' }
  | {
      driver: 's3'
      endpoint?: string
      region: string
      bucket: string
      accessKey: string
      secretKey: string
    }

export async function getStorageConfig(): Promise<StorageConfig> {
  if (process.env.STORAGE_DRIVER === 'local') return { driver: 'local' }
  try {
    const bucket = (await getSetting('storage.s3_bucket')) ?? ''
    const accessKey = (await getSetting('storage.s3_access_key')) ?? ''
    const secretKey = (await getSetting('storage.s3_secret_key')) ?? ''
    if (bucket && accessKey && secretKey) {
      return {
        driver: 's3',
        endpoint: (await getSetting('storage.s3_endpoint')) || undefined,
        region: (await getSetting('storage.s3_region')) || 'us-east-1',
        bucket,
        accessKey,
        secretKey,
      }
    }
  } catch {
    /* no DB / settings — fall back to local disk */
  }
  return { driver: 'local' }
}

function s3Client(cfg: Extract<StorageConfig, { driver: 's3' }>) {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: Boolean(cfg.endpoint),
    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
  })
}

export function extensionFor(filename: string, contentType: string) {
  const fromName = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  const allowed = new Set(['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff'])
  if (fromName && allowed.has(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('tiff') || contentType.includes('tif')) return 'tiff'
  return 'jpg'
}

export function originalKeyFor(contributorId: string, ext = 'jpg') {
  return `originals/${contributorId}/${new Date().getUTCFullYear()}/${randomUUID()}.${ext}`
}

export function derivativeKey(originalKey: string, kind: 'preview' | 'watermarked' | 'thumb', ext = 'jpg') {
  return originalKey.replace(/^originals\//, `derivatives/${kind}/`).replace(/\.[^.]+$/, `.${ext}`)
}

export function assertOwnedOriginalKey(key: string, contributorId: string) {
  if (!key || key.includes('..') || !key.startsWith(`originals/${contributorId}/`)) {
    throw new Error('Invalid storage key')
  }
}

function signLocalToken(key: string, expiresAt: number) {
  const payload = `${key}.${expiresAt}`
  const sig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ key, expiresAt, sig })).toString('base64url')
}

export function verifyLocalToken(token: string) {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as {
      key: string
      expiresAt: number
      sig: string
    }
    if (!parsed.key || !parsed.expiresAt || !parsed.sig) return null
    if (parsed.expiresAt < Date.now()) return null
    if (parsed.key.includes('..')) return null
    const expected = createHmac('sha256', config.jwtSecret)
      .update(`${parsed.key}.${parsed.expiresAt}`)
      .digest('hex')
    if (expected !== parsed.sig) return null
    return parsed.key
  } catch {
    return null
  }
}

export async function presignPut(key: string, contentType: string, expiresIn = 3600) {
  const cfg = await getStorageConfig()
  if (cfg.driver === 's3') {
    const client = s3Client(cfg)
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    )
    return {
      driver: 's3' as const,
      key,
      uploadUrl: url,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
    }
  }
  const token = signLocalToken(key, Date.now() + expiresIn * 1000)
  return {
    driver: 'local' as const,
    key,
    uploadUrl: `/api/contributor/uploads/bin/${token}`,
    method: 'PUT' as const,
    headers: { 'Content-Type': contentType },
  }
}

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string) {
  const cfg = await getStorageConfig()
  if (cfg.driver === 's3') {
    const client = s3Client(cfg)
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
    return { key, bytes: body.byteLength, mimeType: contentType }
  }
  const dest = join(LOCAL_ROOT, key)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, body)
  return { key, bytes: body.byteLength, mimeType: contentType }
}

export async function getObjectBuffer(key: string) {
  const cfg = await getStorageConfig()
  if (cfg.driver === 's3') {
    const client = s3Client(cfg)
    const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }))
    const bytes = await res.Body?.transformToByteArray()
    if (!bytes) throw new Error('empty object')
    return Buffer.from(bytes)
  }
  return readFile(join(LOCAL_ROOT, key))
}

export async function objectExists(key: string) {
  try {
    if ((await getStorageConfig()).driver === 'local') {
      await stat(join(LOCAL_ROOT, key))
      return true
    }
    await getObjectBuffer(key)
    return true
  } catch {
    return false
  }
}

export async function streamObject(key: string): Promise<{ stream: Readable; mimeType?: string; bytes?: number }> {
  const cfg = await getStorageConfig()
  if (cfg.driver === 's3') {
    const client = s3Client(cfg)
    const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }))
    if (!res.Body) throw new Error('empty object')
    return {
      stream: res.Body as Readable,
      mimeType: res.ContentType,
      bytes: res.ContentLength,
    }
  }
  const dest = join(LOCAL_ROOT, key)
  const info = await stat(dest)
  return { stream: createReadStream(dest), bytes: info.size }
}

export async function writeLocalUpload(key: string, stream: NodeJS.ReadableStream) {
  if (key.includes('..')) throw new Error('invalid key')
  const dest = join(LOCAL_ROOT, key)
  await mkdir(dirname(dest), { recursive: true })
  await pipeline(stream, createWriteStream(dest))
  const info = await stat(dest)
  if (info.size > MAX_UPLOAD_BYTES) {
    await unlink(dest).catch(() => undefined)
    throw new Error('File exceeds 50 MB')
  }
  if (info.size === 0) {
    await unlink(dest).catch(() => undefined)
    throw new Error('Empty upload')
  }
  return { key, bytes: info.size }
}

export function localStorageRoot() {
  return LOCAL_ROOT
}
