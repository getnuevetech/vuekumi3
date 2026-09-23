import sharp from 'sharp'
import { resolveProvider } from './ai.js'

export type RemediationDecision = 'advisory' | 'quarantine'

export type RemediationProposal = {
  decision: RemediationDecision
  notes: string[]
  contentHash: string | null
  provider: 'openai' | 'dev'
}

/** 64-bit difference hash. Identical files match. This is not a face embedding. */
export async function differenceHash(image: Buffer): Promise<string> {
  const raw = await sharp(image)
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer()
  let bits = ''
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = raw[y * 9 + x] ?? 0
      const right = raw[y * 9 + x + 1] ?? 0
      bits += left > right ? '1' : '0'
    }
  }
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

export async function applyPreviewAdjustment(image: Buffer, action: 'brighten' | 'crop'): Promise<Buffer> {
  if (action === 'brighten') {
    return sharp(image).rotate().modulate({ brightness: 1.2 }).jpeg({ quality: 82 }).toBuffer()
  }
  const meta = await sharp(image).rotate().metadata()
  const width = meta.width ?? 1
  const height = meta.height ?? 1
  const left = Math.min(Math.round(width * 0.08), Math.max(0, width - 2))
  const top = Math.min(Math.round(height * 0.08), Math.max(0, height - 2))
  const cropWidth = Math.max(1, width - left * 2)
  const cropHeight = Math.max(1, height - top * 2)
  return sharp(image)
    .rotate()
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .jpeg({ quality: 82 })
    .toBuffer()
}

/**
 * Phase 62 — option A. Quarantine and advise. Never rewrite the original.
 * `image_remediation` is resolved so the registry is the caller; pixels are
 * not sent to that provider for an automatic edit.
 */
export async function proposeRemediation(image: Buffer): Promise<RemediationProposal> {
  let provider: 'openai' | 'dev' = 'dev'
  try {
    const resolved = await resolveProvider('image_remediation')
    provider = resolved.kind === 'openai' ? 'openai' : 'dev'
  } catch {
    provider = 'dev'
  }

  const hash = await differenceHash(image)
  const meta = await sharp(image).rotate().metadata()
  const stats = await sharp(image).rotate().greyscale().stats()
  const mean = stats.channels[0]?.mean ?? 128
  const spread = stats.channels[0]?.stdev ?? 0
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const notes: string[] = []

  if (mean < 40) notes.push('This photograph looks underexposed. A brighter preview is optional — the original is unchanged.')
  if (mean > 220) notes.push('This photograph looks overexposed. The original is unchanged.')
  if (spread < 12) notes.push('Contrast is very low. Consider a stronger exposure before publishing.')
  if (width > 0 && height > 0 && (width < 800 || height < 600)) {
    notes.push(`Resolution is ${width}×${height}. Auto-publish expects at least 800×600.`)
  }
  if (provider === 'openai') {
    notes.push('An image-remediation provider is configured. It is not allowed to rewrite the file unless you apply a preview adjustment.')
  }

  const quarantine = mean < 18 || spread < 4 || (width > 0 && width < 200) || (height > 0 && height < 200)
  if (quarantine && notes.length === 0) {
    notes.push('Quality is too low to publish automatically. The original file was not altered.')
  }
  if (!quarantine && notes.length === 0) {
    notes.push('No automatic quality change. The original file was not altered.')
  }

  return {
    decision: quarantine ? 'quarantine' : 'advisory',
    notes,
    contentHash: hash,
    provider,
  }
}
