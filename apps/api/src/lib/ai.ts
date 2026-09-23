import { AI_PROVIDER_PURPOSES, PHOTO_CATEGORIES, type AiProviderPurpose } from '@vuekumi/shared'
import sharp from 'sharp'
import { config } from '../config.js'
import { decryptSecret, getSetting } from './settings.js'
import { prisma } from './prisma.js'
import { getObjectBuffer } from './storage.js'

export type SuggestionPayload = {
  provider: 'openai' | 'dev'
  title: string | null
  description: string | null
  category: string | null
  country: string | null
  tags: string[]
  hasRecognizablePeople: boolean | null
  notes: string | null
}

export class AiError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'AiError'
    this.statusCode = statusCode
  }
}

export type ResolvedProvider =
  | { kind: 'openai'; key: string; base: string; model: string; providerId: string | null; providerName: string }
  | { kind: 'dev' }

/**
 * Phase 58 — per-purpose provider dispatch. Looks up `AiProvider` rows
 * registered for this exact purpose first (lowest `priority` wins, so a
 * fallback provider can be registered without removing the primary), then
 * falls back to the single legacy `ai.openai_api_key` setting and the old
 * untyped 'vision'/'openai' provider row so installs configured before this
 * phase keep working unchanged for every purpose, then dev/no-op.
 */
export async function resolveProvider(purpose: AiProviderPurpose): Promise<ResolvedProvider> {
  const model = (await getSetting('ai.openai_model')) || 'gpt-4o-mini'

  const rows = await prisma.aiProvider.findMany({
    where: { purpose, enabled: true, apiKeyEnc: { not: null } },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })
  for (const row of rows) {
    if (!row.apiKeyEnc) continue
    try {
      const key = decryptSecret(row.apiKeyEnc)
      if (!key) continue
      return {
        kind: 'openai' as const,
        key,
        base: (row.apiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
        model,
        providerId: row.id,
        providerName: row.name,
      }
    } catch {
      // A key saved under a different settings key cannot be used. Try the next provider.
    }
  }

  const legacyKey = (await getSetting('ai.openai_api_key')) ?? ''
  if (legacyKey) {
    return {
      kind: 'openai',
      key: legacyKey,
      base: 'https://api.openai.com/v1',
      model,
      providerId: null,
      providerName: 'ai.openai_api_key setting',
    }
  }

  const legacyRow = await prisma.aiProvider.findFirst({
    where: { enabled: true, apiKeyEnc: { not: null }, OR: [{ slug: 'openai' }, { purpose: 'vision' }] },
  })
  if (legacyRow?.apiKeyEnc) {
    try {
      const key = decryptSecret(legacyRow.apiKeyEnc)
      if (key) {
        return {
          kind: 'openai' as const,
          key,
          base: (legacyRow.apiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
          model,
          providerId: legacyRow.id,
          providerName: legacyRow.name,
        }
      }
    } catch {
      // Unreadable legacy key falls through to the settings key or dev mode.
    }
  }

  if (config.isDev) return { kind: 'dev' }
  throw new AiError(`Add an AI provider for "${purpose}" in Admin Settings to run this feature.`, 503)
}

export { AI_PROVIDER_PURPOSES }

export function heuristicSuggest(input: {
  title?: string | null
  category?: string | null
  country?: string | null
  filename?: string | null
  tags?: string[]
}): SuggestionPayload {
  const fromFile = (input.filename ?? '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  const title = (input.title && input.title.length > 2 ? input.title : fromFile) || 'Untitled photograph'
  const category = PHOTO_CATEGORIES.includes((input.category ?? '') as (typeof PHOTO_CATEGORIES)[number])
    ? input.category!
    : 'Landscape'
  const country = input.country || null
  const words = `${title} ${category} ${country ?? ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && w !== 'the' && w !== 'and')
  const tags = [...new Set([...(input.tags ?? []), ...words])].slice(0, 8)
  const peopleCats = new Set(['People', 'Fashion', 'Culture'])
  return {
    provider: 'dev',
    title: title.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 160),
    description: country
      ? `${title} — photographed in ${country}. Review this draft before publishing.`
      : `${title}. Review this draft before publishing.`,
    category,
    country,
    tags,
    hasRecognizablePeople: peopleCats.has(category),
    notes: 'Test suggestion (no OpenAI key). Nothing was applied automatically.',
  }
}

function normalizeSuggestion(raw: Partial<SuggestionPayload>, fallback: SuggestionPayload): SuggestionPayload {
  const category = PHOTO_CATEGORIES.includes((raw.category ?? '') as (typeof PHOTO_CATEGORIES)[number])
    ? raw.category!
    : fallback.category
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 12)
    : fallback.tags
  return {
    provider: 'openai',
    title: raw.title?.trim().slice(0, 160) || fallback.title,
    description: raw.description?.trim().slice(0, 2000) || fallback.description,
    category,
    country: raw.country?.trim().slice(0, 80) || fallback.country,
    tags,
    hasRecognizablePeople:
      typeof raw.hasRecognizablePeople === 'boolean' ? raw.hasRecognizablePeople : fallback.hasRecognizablePeople,
    notes: raw.notes?.trim().slice(0, 500) || null,
  }
}

export async function resizeForVision(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()
}

async function callOpenAi(
  provider: { key: string; base: string; model: string },
  context: string,
  imageJpeg?: Buffer,
): Promise<SuggestionPayload> {
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `You catalog African stock photography for Vuekumi. Suggest metadata. Return JSON only with keys:
title, description, category, country, tags (array of short lowercase tags), hasRecognizablePeople (boolean), notes (optional quality/people note).
Category must be one of: ${PHOTO_CATEGORIES.join(', ')}.
Do not claim ownership. Description is one or two sentences.
Context: ${context}`,
    },
  ]
  if (imageJpeg) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${imageJpeg.toString('base64')}` },
    })
  }

  const res = await fetch(`${provider.base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You return only valid JSON for photo metadata suggestions. A human will review every field.' },
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
    throw new AiError(json.error?.message ?? 'OpenAI request failed', 502)
  }
  const text = json.choices?.[0]?.message?.content ?? '{}'
  let parsed: Partial<SuggestionPayload> = {}
  try {
    parsed = JSON.parse(text) as Partial<SuggestionPayload>
  } catch {
    throw new AiError('OpenAI returned invalid JSON', 502)
  }
  return normalizeSuggestion(parsed, heuristicSuggest({ title: context }))
}

export async function suggestFromContext(input: {
  title?: string | null
  category?: string | null
  country?: string | null
  filename?: string | null
  tags?: string[]
  image?: Buffer | null
}): Promise<SuggestionPayload> {
  const fallback = heuristicSuggest(input)
  const provider = await resolveProvider('image_analysis')
  if (provider.kind === 'dev') return fallback
  const jpeg = input.image ? await resizeForVision(input.image) : undefined
  return callOpenAi(provider, JSON.stringify({
    title: input.title,
    category: input.category,
    country: input.country,
    filename: input.filename,
    tags: input.tags,
  }), jpeg)
}

export async function loadPhotoImage(photo: {
  id: string
  src: string
  storageKey: string | null
  assets?: { kind: string; storageKey: string }[]
}) {
  const preview = photo.assets?.find((a) => a.kind === 'preview')
  const thumb = photo.assets?.find((a) => a.kind === 'thumb')
  const key = preview?.storageKey ?? thumb?.storageKey ?? photo.storageKey
  if (key && !key.startsWith('/')) {
    try {
      return await getObjectBuffer(key)
    } catch {
      /* fall through */
    }
  }
  return null
}
