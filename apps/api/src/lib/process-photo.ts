import type { AssetKind } from '@prisma/client'
import { processDerivatives } from './images.js'
import { prisma } from './prisma.js'
import { derivativeKey, getObjectBuffer, MAX_UPLOAD_BYTES, putObject } from './storage.js'

async function upsertAsset(
  photoId: string,
  kind: AssetKind,
  storageKey: string,
  bytes: number,
  width?: number,
  height?: number,
  mimeType = 'image/jpeg',
) {
  await prisma.photoAsset.upsert({
    where: { photoId_kind: { photoId, kind } },
    create: { photoId, kind, storageKey, bytes, width, height, mimeType },
    update: { storageKey, bytes, width, height, mimeType },
  })
}

export async function processPhotoAssets(photoId: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { assets: true },
  })
  if (!photo) throw new Error('Photo not found')
  const original = photo.assets.find((a) => a.kind === 'original')
  if (!original) throw new Error('Original asset missing')

  await prisma.photo.update({
    where: { id: photoId },
    data: { processingStatus: 'processing' },
  })

  try {
    const buffer = await getObjectBuffer(original.storageKey)
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error('File exceeds 50 MB')
    }

    const premium = photo.licenseType === 'premium'
    const derived = await processDerivatives(buffer, premium)

    const previewKey = derivativeKey(original.storageKey, 'preview')
    const thumbKey = derivativeKey(original.storageKey, 'thumb')
    const preview = await putObject(previewKey, derived.preview, 'image/jpeg')
    const thumb = await putObject(thumbKey, derived.thumb, 'image/jpeg')

    await upsertAsset(photoId, 'preview', preview.key, preview.bytes, derived.width, derived.height)
    await upsertAsset(photoId, 'thumb', thumb.key, thumb.bytes, derived.width, derived.height)

    if (derived.watermarked) {
      const wmKey = derivativeKey(original.storageKey, 'watermarked')
      const wm = await putObject(wmKey, derived.watermarked, 'image/jpeg')
      await upsertAsset(photoId, 'watermarked', wm.key, wm.bytes, derived.width, derived.height)
    }

    await prisma.photo.update({
      where: { id: photoId },
      data: {
        width: derived.width,
        height: derived.height,
        storageKey: original.storageKey,
        src: `/api/media/${photoId}/preview`,
        processingStatus: 'ready',
      },
    })
  } catch (err) {
    await prisma.photo.update({
      where: { id: photoId },
      data: { processingStatus: 'failed' },
    })
    throw err
  }
}
