import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { seedCountries } from '../lib/geo.js'
import { effectiveRate, syncExchangeRates } from '../lib/fx.js'
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
  const admin = { preHandler: requireAccountTypes(app, 'admin') }

  app.get('/admin/countries', admin, async () => {
    const countries = await prisma.country.findMany({ orderBy: [{ region: 'asc' }, { name: 'asc' }] })
    return { countries }
  })

  app.post('/admin/countries', admin, async (request) => {
    const body = countrySchema.parse(request.body)
    const country = await prisma.country.upsert({
      where: { code: body.code },
      create: { ...body, sortOrder: body.region === 'africa' ? 10 : 40 },
      update: body,
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

  app.patch('/admin/countries/:code', admin, async (request, reply) => {
    const { code } = request.params as { code: string }
    const body = countrySchema.partial().parse(request.body)
    const existing = await prisma.country.findUnique({ where: { code: code.toUpperCase() } })
    if (!existing) return reply.code(404).send({ error: 'Country not found' })
    const country = await prisma.country.update({ where: { code: existing.code }, data: body })
    return { country }
  })

  app.get('/admin/exchange-rates', admin, async () => {
    const rates = await prisma.exchangeRate.findMany({ orderBy: { currency: 'asc' } })
    return {
      rates: rates.map((r) => {
        const { rate, source } = effectiveRate(r)
        return { ...r, effectiveRate: rate, effectiveSource: source }
      }),
    }
  })

  app.post('/admin/exchange-rates/sync', admin, async (request) => {
    const result = await syncExchangeRates()
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.sync_exchange_rates',
      entityType: 'exchange_rate',
      metadata: { updated: result.updated },
    })
    return result
  })

  app.patch('/admin/exchange-rates/:currency', admin, async (request, reply) => {
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

  app.post('/admin/countries/seed-defaults', admin, async () => {
    await seedCountries()
    const countries = await prisma.country.findMany()
    return { ok: true, count: countries.length }
  })
}
