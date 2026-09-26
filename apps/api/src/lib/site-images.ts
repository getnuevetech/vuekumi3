import { randomUUID } from 'node:crypto'
import { siteImageUploadSchema, type SiteImageUploadInput } from '@vuekumi/shared'
import { stripOriginalMetadata } from './images.js'
import { putObject } from './storage.js'

const MAX_BYTES = 8 * 1024 * 1024

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number }
  err.statusCode = statusCode
  return err
}

export async function saveSiteImage(input: SiteImageUploadInput) {
  const body = siteImageUploadSchema.parse(input)
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(body.contentType)) {
    throw httpError('Upload a JPEG, PNG, or WebP image.')
  }
  const raw = Buffer.from(body.dataBase64, 'base64')
  if (!raw.length || raw.length > MAX_BYTES) throw httpError('Image must be 8 MB or smaller.')
  const processed = await stripOriginalMetadata(raw)
  const ext = processed.mimeType === 'image/png' ? 'png' : processed.mimeType === 'image/webp' ? 'webp' : 'jpg'
  const file = `${randomUUID()}.${ext}`
  const key = `site/${body.kind}/${file}`
  await putObject(key, processed.buffer, processed.mimeType)
  return { src: `/api/media/site/${body.kind}/${file}` }
}
