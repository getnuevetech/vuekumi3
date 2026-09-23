import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { AI_PROVIDER_PURPOSES } from '@vuekumi/shared'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { encryptSecret, readStoredSecret } from '../lib/settings.js'
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
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

const aiPatchSchema = z.object({
  name: z.string().min(2).optional(),
  slug: slugSchema.optional(),
  purpose: z.enum(AI_PROVIDER_PURPOSES).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  apiBaseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

function uniqueSlugMessage(err: unknown, noun: string): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return `A ${noun} with this slug already exists. Update the existing row instead of adding it again.`
  }
  return null
}

function publicGateway<T extends { configEnc: string | null }>(gateway: T) {
  const secret = readStoredSecret(gateway.configEnc)
  return {
    ...gateway,
    configEnc: undefined,
    hasSecret: secret.hasSecret,
    secretReadable: secret.readable,
    secretMasked: secret.masked,
  }
}

function publicProvider<T extends { apiKeyEnc: string | null }>(provider: T) {
  const secret = readStoredSecret(provider.apiKeyEnc)
  return {
    ...provider,
    apiKeyEnc: undefined,
    hasKey: secret.hasSecret,
    keyReadable: secret.readable,
    keyMasked: secret.masked,
  }
}

export async function adminIntegrationRoutes(app: FastifyInstance) {
  const readGateways = { preHandler: requireAdminCapability(app, 'integrations.gateways.read') }
  const writeGateways = { preHandler: requireAdminCapability(app, 'integrations.gateways.write') }
  const readAi = { preHandler: requireAdminCapability(app, 'integrations.ai.read') }
  const writeAi = { preHandler: requireAdminCapability(app, 'integrations.ai.write') }

  app.get('/admin/gateways', readGateways, async () => {
    const gateways = await prisma.paymentGateway.findMany({ orderBy: { name: 'asc' } })
    return { gateways: gateways.map(publicGateway) }
  })

  app.post('/admin/gateways', writeGateways, async (request, reply) => {
    const body = gatewaySchema.parse(request.body)
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
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.create_gateway',
        entityType: 'payment_gateway',
        entityId: gateway.id,
      })
      return { gateway: publicGateway(gateway) }
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
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.update_gateway',
        entityType: 'payment_gateway',
        entityId: gateway.id,
      })
      return { gateway: publicGateway(gateway) }
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
    return { providers: providers.map(publicProvider) }
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
          apiKeyEnc: body.apiKey ? encryptSecret(body.apiKey) : undefined,
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.create_ai_provider',
        entityType: 'ai_provider',
        entityId: provider.id,
      })
      return { provider: publicProvider(provider) }
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
          ...(body.apiKey ? { apiKeyEnc: encryptSecret(body.apiKey) } : {}),
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.update_ai_provider',
        entityType: 'ai_provider',
        entityId: provider.id,
      })
      return { provider: publicProvider(provider) }
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
