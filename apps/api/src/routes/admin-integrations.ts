import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { AI_PROVIDER_PURPOSES } from '@vuekumi/shared'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { normalizeSecret, stripeSecretProblem } from '../lib/payments-config.js'
import { encryptSecret, getSettingSafe, maskSecret, readStoredSecret } from '../lib/settings.js'
import { prisma } from '../lib/prisma.js'

const slugSchema = z.string().trim().min(2).max(60).transform((value) =>
  value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, ''),
).refine((value) => /^[a-z0-9-]{2,}$/.test(value), 'Slug can only use letters, numbers, and hyphens')

const gatewaySchema = z.object({
  name: z.string().min(2),
  slug: slugSchema,
  kind: z.enum(['payout', 'checkout', 'both']),
  countries: z.array(z.string()).default([]),
  currencies: z.array(z.string()).default([]),
  secretKey: z.string().optional(),
  publicKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

const gatewayPatchSchema = z.object({
  name: z.string().min(2).optional(),
  slug: slugSchema.optional(),
  kind: z.enum(['payout', 'checkout', 'both']).optional(),
  countries: z.array(z.string()).optional(),
  currencies: z.array(z.string()).optional(),
  secretKey: z.string().optional(),
  publicKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

const aiSchema = z.object({
  name: z.string().min(2),
  slug: slugSchema,
  purpose: z.enum(AI_PROVIDER_PURPOSES),
  priority: z.number().int().min(0).max(1000).optional(),
  apiBaseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
  model: z.string().max(120).optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

const currentPurposes = new Set<string>(AI_PROVIDER_PURPOSES)

const aiPatchSchema = z.object({
  name: z.string().min(2).optional(),
  slug: slugSchema.optional(),
  purpose: z.string().trim().min(1).max(60).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  apiBaseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
  model: z.string().max(120).optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

function uniqueSlugMessage(err: unknown, noun: string): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return `A ${noun} with this slug already exists. Update the existing row instead of adding it again.`
  }
  return null
}

type GatewayRow = {
  id: string
  name: string
  slug: string
  kind: string
  countries: string[]
  currencies: string[]
  publicKey: string | null
  notes: string | null
  enabled: boolean
  configEnc: string | null
  webhookSecretEnc: string | null
  createdAt: Date
  updatedAt: Date
}

type ProviderRow = {
  id: string
  name: string
  slug: string
  purpose: string
  priority: number
  apiBaseUrl: string | null
  notes: string | null
  enabled: boolean
  apiKeyEnc: string | null
  modelName: string | null
  createdAt: Date
  updatedAt: Date
}

function isStripeSlug(slug: string) {
  const key = slug.toLowerCase()
  return key === 'stripe' || key.startsWith('stripe-')
}

function isFlutterwaveSlug(slug: string) {
  const key = slug.toLowerCase()
  return key === 'flutterwave' || key.startsWith('flutterwave-')
}

function stripeFieldProblem(slug: string, body: { secretKey?: string; publicKey?: string; webhookSecret?: string }) {
  if (!isStripeSlug(slug)) return null
  if (body.secretKey?.trim()) {
    const problem = stripeSecretProblem(body.secretKey)
    if (problem) return problem
  }
  const publicKey = normalizeSecret(body.publicKey)
  if (publicKey && (publicKey.startsWith('sk_') || publicKey.startsWith('rk_') || publicKey.startsWith('whsec_'))) {
    return 'The publishable key should start with pk_. Put the secret key in the secret field and the webhook secret in the webhook field.'
  }
  const webhook = normalizeSecret(body.webhookSecret)
  if (webhook && (webhook.startsWith('sk_') || webhook.startsWith('rk_') || webhook.startsWith('pk_'))) {
    return 'The webhook secret should start with whsec_. Put the API secret in the secret key field.'
  }
  return null
}

function publicGateway(gateway: GatewayRow) {
  const secret = readStoredSecret(gateway.configEnc)
  const webhook = readStoredSecret(gateway.webhookSecretEnc)
  return {
    id: gateway.id,
    name: gateway.name,
    slug: gateway.slug,
    kind: gateway.kind,
    countries: gateway.countries,
    currencies: gateway.currencies,
    publicKey: gateway.publicKey,
    publicKeySource: (gateway.publicKey ? 'gateway' : null) as 'gateway' | 'settings' | null,
    notes: gateway.notes,
    enabled: gateway.enabled,
    createdAt: gateway.createdAt,
    updatedAt: gateway.updatedAt,
    hasSecret: secret.hasSecret,
    secretReadable: secret.readable,
    secretMasked: secret.masked,
    secretSource: (secret.hasSecret ? 'gateway' : null) as 'gateway' | 'settings' | null,
    hasWebhook: webhook.hasSecret,
    webhookReadable: webhook.readable,
    webhookMasked: webhook.masked,
    webhookSource: (webhook.hasSecret ? 'gateway' : null) as 'gateway' | 'settings' | null,
  }
}

async function legacyPayment(slug: string) {
  if (isStripeSlug(slug)) {
    const [secret, publicKey, webhook] = await Promise.all([
      getSettingSafe('payments.stripe.secret_key'),
      getSettingSafe('payments.stripe.publishable_key'),
      getSettingSafe('payments.stripe.webhook_secret'),
    ])
    return { secret, publicKey, webhook }
  }
  if (isFlutterwaveSlug(slug)) {
    const [secret, publicKey, webhook] = await Promise.all([
      getSettingSafe('payments.flutterwave.secret_key'),
      getSettingSafe('payments.flutterwave.public_key'),
      getSettingSafe('payments.flutterwave.secret_hash'),
    ])
    return { secret, publicKey, webhook }
  }
  return { secret: null, publicKey: null, webhook: null }
}

async function presentGateway(gateway: GatewayRow) {
  const view = publicGateway(gateway)
  const legacy = await legacyPayment(gateway.slug)
  if (!view.hasSecret && legacy.secret) {
    view.hasSecret = true
    view.secretReadable = true
    view.secretMasked = maskSecret(legacy.secret)
    view.secretSource = 'settings'
  }
  if (!view.hasWebhook && legacy.webhook) {
    view.hasWebhook = true
    view.webhookReadable = true
    view.webhookMasked = maskSecret(legacy.webhook)
    view.webhookSource = 'settings'
  }
  if (!view.publicKey && legacy.publicKey) {
    view.publicKey = legacy.publicKey
    view.publicKeySource = 'settings'
  }
  return view
}

function publicProvider(provider: ProviderRow) {
  const secret = readStoredSecret(provider.apiKeyEnc)
  return {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    purpose: provider.purpose,
    priority: provider.priority,
    apiBaseUrl: provider.apiBaseUrl,
    model: provider.modelName,
    modelSource: (provider.modelName ? 'provider' : null) as 'provider' | 'settings' | null,
    notes: provider.notes,
    enabled: provider.enabled,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    hasKey: secret.hasSecret,
    keyReadable: secret.readable,
    keyMasked: secret.masked,
    keySource: (secret.hasSecret ? 'provider' : null) as 'provider' | 'settings' | null,
  }
}

async function legacyAi(slug: string) {
  const key = slug.toLowerCase()
  if (key === 'openai' || key.startsWith('openai-')) {
    const [apiKey, model] = await Promise.all([
      getSettingSafe('ai.openai_api_key'),
      getSettingSafe('ai.openai_model'),
    ])
    return { apiKey, model }
  }
  if (key === 'replicate' || key.startsWith('replicate-')) {
    return { apiKey: await getSettingSafe('ai.replicate_api_token'), model: null as string | null }
  }
  return { apiKey: null, model: null as string | null }
}

async function presentProvider(provider: ProviderRow) {
  const view = publicProvider(provider)
  const legacy = await legacyAi(provider.slug)
  if (!view.hasKey && legacy.apiKey) {
    view.hasKey = true
    view.keyReadable = true
    view.keyMasked = maskSecret(legacy.apiKey)
    view.keySource = 'settings'
  }
  if (!view.model && legacy.model) {
    view.model = legacy.model
    view.modelSource = 'settings'
  }
  return view
}

export async function adminIntegrationRoutes(app: FastifyInstance) {
  const readGateways = { preHandler: requireAdminCapability(app, 'integrations.gateways.read') }
  const writeGateways = { preHandler: requireAdminCapability(app, 'integrations.gateways.write') }
  const readAi = { preHandler: requireAdminCapability(app, 'integrations.ai.read') }
  const writeAi = { preHandler: requireAdminCapability(app, 'integrations.ai.write') }

  app.get('/admin/gateways', readGateways, async () => {
    const gateways = await prisma.paymentGateway.findMany({ orderBy: { name: 'asc' } })
    return { gateways: await Promise.all(gateways.map((row) => presentGateway(row))) }
  })

  app.post('/admin/gateways', writeGateways, async (request, reply) => {
    const body = gatewaySchema.parse(request.body)
    const problem = stripeFieldProblem(body.slug, body)
    if (problem) return reply.code(400).send({ error: problem })
    try {
      const gateway = await prisma.paymentGateway.create({
        data: {
          name: body.name,
          slug: body.slug,
          kind: body.kind,
          countries: body.countries.map((c) => c.toUpperCase()),
          currencies: body.currencies.map((c) => c.toUpperCase()),
          publicKey: body.publicKey,
          notes: body.notes,
          enabled: body.enabled ?? true,
          configEnc: body.secretKey ? encryptSecret(body.secretKey) : undefined,
          webhookSecretEnc: body.webhookSecret ? encryptSecret(body.webhookSecret) : undefined,
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.create_gateway',
        entityType: 'payment_gateway',
        entityId: gateway.id,
      })
      return { gateway: await presentGateway(gateway) }
    } catch (err) {
      const conflict = uniqueSlugMessage(err, 'payment gateway')
      if (conflict) return reply.code(409).send({ error: conflict })
      throw err
    }
  })

  app.patch('/admin/gateways/:id', writeGateways, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = gatewayPatchSchema.parse(request.body)
    const existing = await prisma.paymentGateway.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'Gateway not found' })
    const problem = stripeFieldProblem(body.slug ?? existing.slug, body)
    if (problem) return reply.code(400).send({ error: problem })
    try {
      const gateway = await prisma.paymentGateway.update({
        where: { id },
        data: {
          ...('name' in body ? { name: body.name } : {}),
          ...('slug' in body ? { slug: body.slug } : {}),
          ...('kind' in body ? { kind: body.kind } : {}),
          ...('countries' in body ? { countries: body.countries?.map((c) => c.toUpperCase()) } : {}),
          ...('currencies' in body ? { currencies: body.currencies?.map((c) => c.toUpperCase()) } : {}),
          ...('publicKey' in body ? { publicKey: body.publicKey } : {}),
          ...('notes' in body ? { notes: body.notes } : {}),
          ...('enabled' in body ? { enabled: body.enabled } : {}),
          ...(body.secretKey ? { configEnc: encryptSecret(body.secretKey) } : {}),
          ...(body.webhookSecret ? { webhookSecretEnc: encryptSecret(body.webhookSecret) } : {}),
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.update_gateway',
        entityType: 'payment_gateway',
        entityId: gateway.id,
      })
      return { gateway: await presentGateway(gateway) }
    } catch (err) {
      const conflict = uniqueSlugMessage(err, 'payment gateway')
      if (conflict) return reply.code(409).send({ error: conflict })
      throw err
    }
  })

  app.delete('/admin/gateways/:id', writeGateways, async (request) => {
    const { id } = request.params as { id: string }
    await prisma.paymentGateway.delete({ where: { id } })
    return { ok: true }
  })

  app.get('/admin/ai-providers', readAi, async () => {
    const providers = await prisma.aiProvider.findMany({
      orderBy: [{ purpose: 'asc' }, { priority: 'asc' }, { name: 'asc' }],
    })
    return { providers: await Promise.all(providers.map((row) => presentProvider(row))) }
  })

  app.post('/admin/ai-providers', writeAi, async (request, reply) => {
    const body = aiSchema.parse(request.body)
    try {
      const provider = await prisma.aiProvider.create({
        data: {
          name: body.name,
          slug: body.slug,
          purpose: body.purpose,
          priority: body.priority ?? 0,
          apiBaseUrl: body.apiBaseUrl || null,
          notes: body.notes,
          enabled: body.enabled ?? true,
          modelName: body.model?.trim() || null,
          apiKeyEnc: body.apiKey ? encryptSecret(body.apiKey) : undefined,
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.create_ai_provider',
        entityType: 'ai_provider',
        entityId: provider.id,
      })
      return { provider: await presentProvider(provider) }
    } catch (err) {
      const conflict = uniqueSlugMessage(err, 'AI provider')
      if (conflict) return reply.code(409).send({ error: conflict })
      throw err
    }
  })

  app.patch('/admin/ai-providers/:id', writeAi, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = aiPatchSchema.parse(request.body)
    const existing = await prisma.aiProvider.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'Provider not found' })
    if (body.purpose && !currentPurposes.has(body.purpose) && body.purpose !== existing.purpose) {
      return reply.code(400).send({
        error: 'Choose a purpose from the list. An older purpose such as vision can stay until you pick a current one.',
      })
    }
    try {
      const provider = await prisma.aiProvider.update({
        where: { id },
        data: {
          ...('name' in body ? { name: body.name } : {}),
          ...('slug' in body ? { slug: body.slug } : {}),
          ...('purpose' in body ? { purpose: body.purpose } : {}),
          ...('priority' in body ? { priority: body.priority } : {}),
          ...('apiBaseUrl' in body ? { apiBaseUrl: body.apiBaseUrl || null } : {}),
          ...('notes' in body ? { notes: body.notes } : {}),
          ...('enabled' in body ? { enabled: body.enabled } : {}),
          ...('model' in body ? { modelName: body.model?.trim() || null } : {}),
          ...(body.apiKey ? { apiKeyEnc: encryptSecret(body.apiKey) } : {}),
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.update_ai_provider',
        entityType: 'ai_provider',
        entityId: provider.id,
      })
      return { provider: await presentProvider(provider) }
    } catch (err) {
      const conflict = uniqueSlugMessage(err, 'AI provider')
      if (conflict) return reply.code(409).send({ error: conflict })
      throw err
    }
  })

  app.delete('/admin/ai-providers/:id', writeAi, async (request) => {
    const { id } = request.params as { id: string }
    await prisma.aiProvider.delete({ where: { id } })
    return { ok: true }
  })
}
