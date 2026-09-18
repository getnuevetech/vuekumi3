import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { encryptSecret, maskSecret, decryptSecret } from '../lib/settings.js'
import { prisma } from '../lib/prisma.js'

const gatewaySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  kind: z.enum(['payout', 'checkout', 'both']),
  countries: z.array(z.string()).default([]),
  currencies: z.array(z.string()).default([]),
  secretKey: z.string().optional(),
  publicKey: z.string().optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

const aiSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  purpose: z.string().min(2),
  apiBaseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
})

export async function adminIntegrationRoutes(app: FastifyInstance) {
  const readGateways = { preHandler: requireAdminCapability(app, 'integrations.gateways.read') }
  const writeGateways = { preHandler: requireAdminCapability(app, 'integrations.gateways.write') }
  const readAi = { preHandler: requireAdminCapability(app, 'integrations.ai.read') }
  const writeAi = { preHandler: requireAdminCapability(app, 'integrations.ai.write') }

  app.get('/admin/gateways', readGateways, async () => {
    const gateways = await prisma.paymentGateway.findMany({ orderBy: { name: 'asc' } })
    return {
      gateways: gateways.map((g) => ({
        ...g,
        configEnc: undefined,
        hasSecret: Boolean(g.configEnc),
        secretMasked: g.configEnc ? maskSecret(decryptSecret(g.configEnc)) : '',
      })),
    }
  })

  app.post('/admin/gateways', writeGateways, async (request) => {
    const body = gatewaySchema.parse(request.body)
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
    return { gateway: { ...gateway, configEnc: undefined, hasSecret: Boolean(gateway.configEnc) } }
  })

  app.patch('/admin/gateways/:id', writeGateways, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = gatewaySchema.partial().parse(request.body)
    const existing = await prisma.paymentGateway.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'Gateway not found' })
    const gateway = await prisma.paymentGateway.update({
      where: { id },
      data: {
        ...('name' in body ? { name: body.name } : {}),
        ...('kind' in body ? { kind: body.kind } : {}),
        ...('countries' in body ? { countries: body.countries?.map((c) => c.toUpperCase()) } : {}),
        ...('currencies' in body ? { currencies: body.currencies?.map((c) => c.toUpperCase()) } : {}),
        ...('publicKey' in body ? { publicKey: body.publicKey } : {}),
        ...('notes' in body ? { notes: body.notes } : {}),
        ...('enabled' in body ? { enabled: body.enabled } : {}),
        ...(body.secretKey ? { configEnc: encryptSecret(body.secretKey) } : {}),
      },
    })
    return { gateway: { ...gateway, configEnc: undefined, hasSecret: Boolean(gateway.configEnc) } }
  })

  app.delete('/admin/gateways/:id', writeGateways, async (request) => {
    const { id } = request.params as { id: string }
    await prisma.paymentGateway.delete({ where: { id } })
    return { ok: true }
  })

  app.get('/admin/ai-providers', readAi, async () => {
    const providers = await prisma.aiProvider.findMany({ orderBy: { name: 'asc' } })
    return {
      providers: providers.map((p) => ({
        ...p,
        apiKeyEnc: undefined,
        hasKey: Boolean(p.apiKeyEnc),
        keyMasked: p.apiKeyEnc ? maskSecret(decryptSecret(p.apiKeyEnc)) : '',
      })),
    }
  })

  app.post('/admin/ai-providers', writeAi, async (request) => {
    const body = aiSchema.parse(request.body)
    const provider = await prisma.aiProvider.create({
      data: {
        name: body.name,
        slug: body.slug,
        purpose: body.purpose,
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
    return { provider: { ...provider, apiKeyEnc: undefined, hasKey: Boolean(provider.apiKeyEnc) } }
  })

  app.patch('/admin/ai-providers/:id', writeAi, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = aiSchema.partial().parse(request.body)
    const existing = await prisma.aiProvider.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'Provider not found' })
    const provider = await prisma.aiProvider.update({
      where: { id },
      data: {
        ...('name' in body ? { name: body.name } : {}),
        ...('purpose' in body ? { purpose: body.purpose } : {}),
        ...('apiBaseUrl' in body ? { apiBaseUrl: body.apiBaseUrl || null } : {}),
        ...('notes' in body ? { notes: body.notes } : {}),
        ...('enabled' in body ? { enabled: body.enabled } : {}),
        ...(body.apiKey ? { apiKeyEnc: encryptSecret(body.apiKey) } : {}),
      },
    })
    return { provider: { ...provider, apiKeyEnc: undefined, hasKey: Boolean(provider.apiKeyEnc) } }
  })

  app.delete('/admin/ai-providers/:id', writeAi, async (request) => {
    const { id } = request.params as { id: string }
    await prisma.aiProvider.delete({ where: { id } })
    return { ok: true }
  })
}
