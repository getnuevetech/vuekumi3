import type { RightsScreeningDto, ScreeningKind } from '@vuekumi/shared'
import { defaultScreening } from '@vuekumi/shared'
import { AiError, resizeForVision, resolveVisionProvider } from './ai.js'
import { getObjectBuffer } from './storage.js'

const PEOPLE_CATEGORIES = new Set(['People', 'Fashion', 'Culture'])

function kindFromCount(count: number | null, crowd: boolean, uncertain: boolean): ScreeningKind {
  if (uncertain) return 'uncertain_human_detection'
  if (crowd) return 'crowd_background_persons'
  if (count === 0) return 'no_recognizable_person'
  if (count === 1) return 'one_recognizable_person'
  if (typeof count === 'number' && count > 1) return 'multiple_recognizable_people'
  return 'uncertain_human_detection'
}

export function heuristicPeopleScreen(input: {
  title?: string | null
  category?: string | null
  filename?: string | null
  declaredPeople?: boolean
}): RightsScreeningDto {
  const hay = `${input.title ?? ''} ${input.category ?? ''} ${input.filename ?? ''}`.toLowerCase()
  const crowd = /\bcrowd\b|\baudience\b|\bmarket\b|\bstreet scene\b/.test(hay)
  const declared = Boolean(input.declaredPeople) || PEOPLE_CATEGORIES.has(input.category ?? '')
  const kind = crowd
    ? 'crowd_background_persons'
    : declared
      ? 'one_recognizable_person'
      : 'no_recognizable_person'
  return {
    ...defaultScreening(kind),
    recognizablePersonCount: kind === 'no_recognizable_person' ? 0 : kind === 'one_recognizable_person' ? 1 : null,
    crowdBackground: crowd,
    possibleMinor: /\bchild\b|\bkid\b|\bminor\b|\bbaby\b/.test(hay),
    selfPortraitLikely: /\bself[- ]?portrait\b|\bselfie\b/.test(hay),
    notes: 'Heuristic person detection only. VueKumi does not identify who appears and does not capture face geometry.',
    provider: 'dev',
    biometricUsed: false,
  }
}

function normalizeScreening(raw: Partial<RightsScreeningDto>, fallback: RightsScreeningDto): RightsScreeningDto {
  const uncertain = Boolean(raw.uncertainHumanDetection) || raw.kind === 'uncertain_human_detection'
  const crowd = Boolean(raw.crowdBackground) || raw.kind === 'crowd_background_persons'
  const count = typeof raw.recognizablePersonCount === 'number' ? raw.recognizablePersonCount : fallback.recognizablePersonCount
  const kind = raw.kind && [
    'no_recognizable_person',
    'one_recognizable_person',
    'multiple_recognizable_people',
    'crowd_background_persons',
    'uncertain_human_detection',
  ].includes(raw.kind)
    ? raw.kind
    : kindFromCount(count, crowd, uncertain)
  return {
    kind,
    recognizablePersonCount: kind === 'no_recognizable_person' ? 0 : count,
    possibleMinor: Boolean(raw.possibleMinor),
    crowdBackground: crowd || kind === 'crowd_background_persons',
    selfPortraitLikely: Boolean(raw.selfPortraitLikely),
    potentiallySensitive: Boolean(raw.potentiallySensitive),
    uncertainHumanDetection: uncertain || kind === 'uncertain_human_detection',
    notes: raw.notes?.trim().slice(0, 500) || fallback.notes,
    provider: 'openai',
    biometricUsed: false,
  }
}

async function callOpenAiPeopleScreen(
  provider: { key: string; base: string; model: string },
  context: string,
  imageJpeg?: Buffer,
): Promise<RightsScreeningDto> {
  const fallback = heuristicPeopleScreen({ title: context })
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `You are VueKumi's rights-screening assistant. Detect whether a photograph contains recognizable human beings.
Do NOT identify who they are. Do NOT estimate exact age. Do NOT extract face geometry, embeddings, or biometric identifiers.
This is Stage 1 person detection only.

Return JSON only:
{
  "recognizablePersonCount": number or null if uncertain,
  "kind": "no_recognizable_person" | "one_recognizable_person" | "multiple_recognizable_people" | "crowd_background_persons" | "uncertain_human_detection",
  "possibleMinor": boolean (flag only; never a determination of age),
  "selfPortraitLikely": boolean,
  "potentiallySensitive": boolean,
  "crowdBackground": boolean,
  "uncertainHumanDetection": boolean,
  "notes": short string
}

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
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You return only valid JSON for person-detection rights screening. You never identify people and never output biometric descriptors.',
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
    throw new AiError(json.error?.message ?? 'OpenAI request failed', 502)
  }
  const text = json.choices?.[0]?.message?.content ?? '{}'
  let parsed: Partial<RightsScreeningDto> = {}
  try {
    parsed = JSON.parse(text) as Partial<RightsScreeningDto>
  } catch {
    throw new AiError('OpenAI returned invalid JSON', 502)
  }
  return normalizeScreening(parsed, fallback)
}

export async function screenImageForRights(input: {
  title?: string | null
  category?: string | null
  filename?: string | null
  declaredPeople?: boolean
  image?: Buffer | null
}): Promise<RightsScreeningDto> {
  const fallback = heuristicPeopleScreen(input)
  try {
    const provider = await resolveVisionProvider()
    if (provider.kind === 'dev') return fallback
    const jpeg = input.image ? await resizeForVision(input.image) : undefined
    return await callOpenAiPeopleScreen(
      provider,
      JSON.stringify({
        title: input.title,
        category: input.category,
        filename: input.filename,
      }),
      jpeg,
    )
  } catch {
    return fallback
  }
}

export async function loadOriginalBytes(storageKey: string | null | undefined): Promise<Buffer | null> {
  if (!storageKey || storageKey.startsWith('/')) return null
  try {
    return await getObjectBuffer(storageKey)
  } catch {
    return null
  }
}

export function screeningWriteData(screening: RightsScreeningDto) {
  return {
    screeningKind: screening.kind,
    screeningPeopleCount: screening.recognizablePersonCount ?? 0,
    possibleMinor: screening.possibleMinor,
    crowdBackground: screening.crowdBackground,
    selfPortraitLikely: screening.selfPortraitLikely,
    potentiallySensitive: screening.potentiallySensitive,
    uncertainHumanDetection: screening.uncertainHumanDetection,
    screeningNotes: screening.notes,
    screeningAt: new Date(),
    screeningProvider: screening.provider,
  }
}
