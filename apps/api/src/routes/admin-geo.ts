import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { seedCountries } from '../lib/geo.js'
import { effectiveRate, syncExchangeRates } from '../lib/fx.js'
import { overlaySeedForCountry } from '../lib/legal.js'
import { prisma } from '../lib/prisma.js'

const countrySchema = z.object({
  code: z.string().length(2).transform((s) => s.toUpperCase()),
  name: z.string().min(2),
  currency: z.string().min(3).max(4).transform((s) => s.toUpperCase()),
  currencyName: z.string().min(2),
  region: z.enum(['africa', 'americas', 'europe', 'asia', 'oceania', 'middle_east']),
  contributorEligible: z.boolean().default(false),
  enabled: z.boolean().default(true),
})

const rateOverrideSchema = z.object({
  overrideRate: z.number().positive().nullable(),
})

export async function adminGeoRoutes(app: FastifyInstance) {
  const listCountries = { preHandler: requireAdminCapability(app, 'geo.countries.list') }
  const writeCountries = { preHandler: requireAdminCapability(app, 'geo.countries.write') }
  const listFx = { preHandler: requireAdminCapability(app, 'geo.fx.list') }
  const syncFx = { preHandler: requireAdminCapability(app, 'geo.fx.sync') }
  const overrideFx = { preHandler: requireAdminCapability(app, 'geo.fx.override') }

  app.get('/admin/countries', listCountries, async () => {
    const countries = await prisma.country.findMany({
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
      include: { legalOverlay: true },
    })
    return {
      countries: countries.map((c) => ({
        code: c.code,
        name: c.name,
        currency: c.currency,
        currencyName: c.currencyName,
        region: c.region,
        contributorEligible: c.contributorEligible,
        enabled: c.enabled,
        overlayKind: c.legalOverlay?.overlayKind ?? null,
        biometricForbidden: c.legalOverlay?.biometricForbidden ?? true,
        counselStatus: c.legalOverlay?.counselStatus ?? 'placeholder',
      })),
    }
  })

  app.post('/admin/countries', writeCountries, async (request, reply) => {
    const body = countrySchema.parse(request.body)
    if (body.contributorEligible && body.region !== 'africa') {
      return reply.code(400).send({ error: 'Country overlays cannot make a non-African country creator-eligible' })
    }
    const country = await prisma.country.upsert({
      where: { code: body.code },
      create: { ...body, sortOrder: body.region === 'africa' ? 10 : 40 },
      update: body,
    })
    await prisma.legalOverlay.upsert({
      where: { countryCode: country.code },
      create: overlaySeedForCountry(country),
      update: { contributorAllowed: country.contributorEligible && country.region === 'africa' },
    })
    await prisma.exchangeRate.upsert({
      where: { currency: body.currency },
      create: { currency: body.currency, rateToUsd: body.currency === 'USD' ? 1 : 1, source: 'auto' },
      update: {},
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.upsert_country',
      entityType: 'country',
      entityId: country.code,
    })
    return { country }
  })

  app.patch('/admin/countries/:code', writeCountries, async (request, reply) => {
    const { code } = request.params as { code: string }
    const body = countrySchema.partial().parse(request.body)
    const existing = await prisma.country.findUnique({ where: { code: code.toUpperCase() } })
    if (!existing) return reply.code(404).send({ error: 'Country not found' })
    const nextRegion = body.region ?? existing.region
    const nextEligible = body.contributorEligible ?? existing.contributorEligible
    if (nextEligible && nextRegion !== 'africa') {
      return reply.code(400).send({ error: 'Country overlays cannot make a non-African country creator-eligible' })
    }
    const country = await prisma.country.update({ where: { code: existing.code }, data: body })
    await prisma.legalOverlay.upsert({
      where: { countryCode: country.code },
      create: overlaySeedForCountry(country),
      update: { contributorAllowed: country.contributorEligible && country.region === 'africa' },
    })
    return { country }
  })

  app.get('/admin/exchange-rates', listFx, async () => {
    const rates = await prisma.exchangeRate.findMany({ orderBy: { currency: 'asc' } })
    return {
      rates: rates.map((r) => {
        const { rate, source } = effectiveRate(r)
        return { ...r, effectiveRate: rate, effectiveSource: source }
      }),
    }
  })

  app.post('/admin/exchange-rates/sync', syncFx, async (request) => {
    const result = await syncExchangeRates()
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.sync_exchange_rates',
      entityType: 'exchange_rate',
      metadata: { updated: result.updated },
    })
    return result
  })

  app.patch('/admin/exchange-rates/:currency', overrideFx, async (request, reply) => {
    const { currency } = request.params as { currency: string }
    const body = rateOverrideSchema.parse(request.body)
    const existing = await prisma.exchangeRate.findUnique({ where: { currency: currency.toUpperCase() } })
    if (!existing) return reply.code(404).send({ error: 'Currency not found — sync rates or add a country first' })
    const rate = await prisma.exchangeRate.update({
      where: { currency: existing.currency },
      data: {
        overrideRate: body.overrideRate,
        source: body.overrideRate == null ? 'auto' : 'override',
      },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.override_exchange_rate',
      entityType: 'exchange_rate',
      entityId: rate.currency,
      metadata: { overrideRate: body.overrideRate },
    })
    return { rate }
  })

  app.post('/admin/countries/seed-defaults', writeCountries, async () => {
    await seedCountries()
    const countries = await prisma.country.findMany()
    return { ok: true, count: countries.length }
  })
}
