import type { LikenessCheckStatus } from '@vuekumi/shared'
import { config } from '../config.js'
import { ModelError } from './models.js'
import { resolveVisionProvider, resizeForVision, loadPhotoImage } from './ai.js'

export const LIKENESS_REFERENCE_MAX_BYTES = 4 * 1024 * 1024

export type LikenessVerdict = {
  status: LikenessCheckStatus
  provider: 'openai' | 'none'
  notes: string
}

export function parseLikenessVerdict(raw: unknown): LikenessCheckStatus {
  const verdict =
    raw && typeof raw === 'object' && 'verdict' in raw
      ? String((raw as { verdict?: unknown }).verdict)
      : ''
  if (verdict === 'similar' || verdict === 'not_similar' || verdict === 'inconclusive') {
    return verdict
  }
  return 'inconclusive'
}

export function likenessCheckBlocked(input: {
  consented: boolean
  claimed: boolean
}): string | null {
  if (!input.consented) {
    return 'Visual verification is opt-in. Confirm you consent to a one-time comparison.'
  }
  if (!input.claimed) {
    return 'Claim this invite before running a likeness check'
  }
  return null
}

export function decodeReferenceImage(imageBase64: string): Buffer {
  const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, '')
  const buffer = Buffer.from(cleaned, 'base64')
  if (buffer.length < 32) {
    throw new ModelError('Reference image is too small')
  }
  if (buffer.length > LIKENESS_REFERENCE_MAX_BYTES) {
    throw new ModelError('Reference image must be 4 MB or smaller')
  }
  return buffer
}

export function likenessNotes(raw: unknown, fallback: string): string {
  const reason =
    raw && typeof raw === 'object' && 'reason' in raw
      ? String((raw as { reason?: unknown }).reason ?? '').trim()
      : ''
  return (reason || fallback).slice(0, 240)
}

async function callOpenAiLikeness(
  provider: { key: string; base: string; model: string },
  photographJpeg: Buffer,
  selfieJpeg: Buffer,
): Promise<LikenessVerdict> {
  const content = [
    {
      type: 'text',
      text: `You compare two photographs for Vuekumi likeness verification.
Image 1 is a stock photograph. Image 2 is a selfie the depicted person uploaded with consent for a one-time check.
Return JSON only with keys: verdict ("similar" | "not_similar" | "inconclusive"), reason (one short sentence).
If either image is not a clear human face, use inconclusive.
Do not identify anyone by name. Do not claim this grants legal rights or a model release.`,
    },
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${photographJpeg.toString('base64')}` },
    },
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${selfieJpeg.toString('base64')}` },
    },
  ]

  const res = await fetch(`${provider.base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Return only valid JSON. Similarity is evidence, never a legal release.',
        },
        { role: 'user', content },
      ],
    }),
    signal: AbortSignal.timeout(35_000),
  })
  const json = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string } }[]
  }
  if (!res.ok) {
    return {
      status: 'unavailable',
      provider: 'openai',
      notes: (json.error?.message ?? 'Vision provider failed').slice(0, 240),
    }
  }
  let parsed: unknown = {}
  try {
    parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}')
  } catch {
    return {
      status: 'inconclusive',
      provider: 'openai',
      notes: 'Vision provider returned invalid JSON',
    }
  }
  return {
    status: parseLikenessVerdict(parsed),
    provider: 'openai',
    notes: likenessNotes(parsed, 'Compared with a vision model. Similarity is not a release.'),
  }
}

export async function loadPhotographBytes(photo: {
  id: string
  src: string
  storageKey: string | null
  assets?: { kind: string; storageKey: string }[]
}): Promise<Buffer | null> {
  const stored = await loadPhotoImage(photo)
  if (stored) return stored
  if (!photo.src.startsWith('/')) return null
  try {
    const res = await fetch(`${config.webUrl}${photo.src}`, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function compareLikeness(input: {
  photograph: Buffer | null
  selfie: Buffer
}): Promise<LikenessVerdict> {
  let selfieJpeg: Buffer
  try {
    selfieJpeg = await resizeForVision(input.selfie)
  } catch {
    throw new ModelError('Reference image could not be read')
  }

  const provider = await resolveVisionProvider()
  if (provider.kind === 'dev') {
    return {
      status: 'unavailable',
      provider: 'none',
      notes: 'No vision key in Admin Settings. Vuekumi did not keep the selfie and did not invent a match.',
    }
  }
  if (!input.photograph) {
    return {
      status: 'unavailable',
      provider: 'none',
      notes: 'Photograph bytes were not available for comparison. The selfie was discarded.',
    }
  }
  const photographJpeg = await resizeForVision(input.photograph)
  return callOpenAiLikeness(provider, photographJpeg, selfieJpeg)
}
