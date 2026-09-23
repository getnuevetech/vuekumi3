import assert from 'node:assert/strict'
import { test } from 'node:test'
import { heuristicSuggest, resolveProvider } from '../src/lib/ai.js'
import { prisma } from '../src/lib/prisma.js'
import { encryptSecret } from '../src/lib/settings.js'

async function setLegacyOpenAiKey(value: string | null) {
  if (value === null) {
    await prisma.platformSetting.deleteMany({ where: { key: 'ai.openai_api_key' } })
    return
  }
  await prisma.platformSetting.upsert({
    where: { key: 'ai.openai_api_key' },
    create: { key: 'ai.openai_api_key', value: encryptSecret(value), secret: true, label: 'OpenAI API key', group: 'AI' },
    update: { value: encryptSecret(value) },
  })
}

async function createProvider(input: { slug: string; purpose: string; priority?: number; apiKey?: string; enabled?: boolean }) {
  return prisma.aiProvider.create({
    data: {
      name: input.slug,
      slug: input.slug,
      purpose: input.purpose,
      priority: input.priority ?? 0,
      enabled: input.enabled ?? true,
      apiKeyEnc: input.apiKey ? encryptSecret(input.apiKey) : null,
    },
  })
}

test('resolveProvider: purpose-specific registry row wins over the legacy global key', async () => {
  await setLegacyOpenAiKey('legacy-key')
  const row = await createProvider({ slug: 'test-image-analysis', purpose: 'image_analysis', apiKey: 'purpose-key' })
  try {
    const resolved = await resolveProvider('image_analysis')
    assert.equal(resolved.kind, 'openai')
    if (resolved.kind === 'openai') {
      assert.equal(resolved.key, 'purpose-key')
      assert.equal(resolved.providerId, row.id)
    }
  } finally {
    await prisma.aiProvider.delete({ where: { id: row.id } })
    await setLegacyOpenAiKey(null)
  }
})

test('resolveProvider: lowest priority wins among providers for the same purpose', async () => {
  const low = await createProvider({ slug: 'test-primary', purpose: 'likeness_matching', priority: 1, apiKey: 'primary-key' })
  const high = await createProvider({ slug: 'test-fallback', purpose: 'likeness_matching', priority: 5, apiKey: 'fallback-key' })
  try {
    const resolved = await resolveProvider('likeness_matching')
    assert.equal(resolved.kind, 'openai')
    if (resolved.kind === 'openai') assert.equal(resolved.key, 'primary-key')
  } finally {
    await prisma.aiProvider.deleteMany({ where: { id: { in: [low.id, high.id] } } })
  }
})

test('resolveProvider: falls back to the legacy global key when no purpose row is registered', async () => {
  await setLegacyOpenAiKey('legacy-only-key')
  try {
    const resolved = await resolveProvider('id_verification')
    assert.equal(resolved.kind, 'openai')
    if (resolved.kind === 'openai') assert.equal(resolved.key, 'legacy-only-key')
  } finally {
    await setLegacyOpenAiKey(null)
  }
})

test('resolveProvider: dev mode when nothing is configured', async () => {
  const resolved = await resolveProvider('image_remediation')
  assert.equal(resolved.kind, 'dev')
})

test('heuristic suggestion never auto-applies and flags people categories', () => {
  const people = heuristicSuggest({ title: 'market portrait', category: 'People', country: 'Nigeria' })
  assert.equal(people.provider, 'dev')
  assert.equal(people.hasRecognizablePeople, true)
  assert.match(people.notes ?? '', /applied automatically/i)
  assert.ok(people.tags.includes('nigeria') || people.tags.includes('market'))
})

test('heuristic falls back to filename and landscape', () => {
  const s = heuristicSuggest({ filename: 'dusk-baobab.jpg' })
  assert.equal(s.category, 'Landscape')
  assert.match(s.title ?? '', /Dusk Baobab/i)
  assert.equal(s.hasRecognizablePeople, false)
})
