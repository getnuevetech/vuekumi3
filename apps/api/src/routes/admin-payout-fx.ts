import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { isPayoutGateway, orderPayoutPartners, syncPayoutRates } from '../lib/payout-fx.js'
import { prisma } from '../lib/prisma.js'

const assignSchema = z.object({
  gatewayId: z.string().min(8).nullable(),
})

export async function adminPayoutFxRoutes(app: FastifyInstance) {
  const list = { preHandler: requireAdminCapability(app, 'geo.fx.list') }
  const assign = { preHandler: requireAdminCapability(app, 'geo.fx.override') }
  const sync = { preHandler: requireAdminCapability(app, 'geo.fx.sync') }

  app.get('/admin/payout-rates', list, async () => {
    const [countries, gateways] = await Promise.all([
      prisma.country.findMany({
        where: { enabled: true },
        include: { payoutConfig: true, payoutRate: true },
        orderBy: [{ contributorEligible: 'desc' }, { region: 'asc' }, { name: 'asc' }],
      }),
      prisma.paymentGateway.findMany({
        where: { enabled: true },
        orderBy: { name: 'asc' },
      }),
    ])
    const payoutGateways = gateways.filter((gateway) => isPayoutGateway(gateway.kind))
    const byRegion = new Map<string, string[]>()
    for (const country of countries) {
      const codes = byRegion.get(country.region) ?? []
      codes.push(country.code)
      byRegion.set(country.region, codes)
    }
    return {
      gateways: payoutGateways.map((gateway) => ({
        id: gateway.id,
        name: gateway.name,
        slug: gateway.slug,
        kind: gateway.kind,
        countries: gateway.countries,
        currencies: gateway.currencies,
      })),
      countries: countries.map((country) => {
        const ordered = orderPayoutPartners({
          countryCode: country.code,
          regionCountryCodes: byRegion.get(country.region) ?? [country.code],
          currency: country.currency,
          primaryId: country.payoutConfig?.gatewayId ?? null,
          gateways: payoutGateways,
        })
        const effective = ordered[0] ?? null
        const rate = country.payoutRate
        return {
          code: country.code,
          name: country.name,
          currency: country.currency,
          currencyName: country.currencyName,
          region: country.region,
          contributorEligible: country.contributorEligible,
          gatewayId: country.payoutConfig?.gatewayId ?? null,
          effectiveGatewayId: effective?.id ?? null,
          effectiveGatewayName: effective?.name ?? null,
          automatic: !country.payoutConfig,
          rate: rate
            ? {
                rateToUsd: rate.rateToUsd,
                currency: rate.currency,
                partnerName: rate.partnerName,
                partnerSlug: rate.partnerSlug,
                source: rate.source,
                fetchedAt: rate.fetchedAt.toISOString(),
              }
            : null,
        }
      }),
    }
  })

  app.put('/admin/payout-rates/:code', assign, async (request, reply) => {
    const { code } = request.params as { code: string }
    const body = assignSchema.parse(request.body)
    const country = await prisma.country.findUnique({ where: { code: code.toUpperCase() } })
    if (!country) return reply.code(404).send({ error: 'Country not found' })
    if (body.gatewayId) {
      const gateway = await prisma.paymentGateway.findUnique({ where: { id: body.gatewayId } })
      if (!gateway || !gateway.enabled || !isPayoutGateway(gateway.kind)) {
        return reply.code(400).send({ error: 'Choose an enabled payout partner' })
      }
      await prisma.countryPayoutConfig.upsert({
        where: { countryCode: country.code },
        create: { countryCode: country.code, gatewayId: gateway.id },
        update: { gatewayId: gateway.id },
      })
    } else {
      await prisma.countryPayoutConfig.deleteMany({ where: { countryCode: country.code } })
    }
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.assign_payout_partner',
      entityType: 'country_payout_config',
      entityId: country.code,
      metadata: { gatewayId: body.gatewayId },
    })
    const result = await syncPayoutRates({ countryCodes: [country.code] })
    return { ok: true, updated: result.updated }
  })

  app.post('/admin/payout-rates/sync', sync, async (request) => {
    const result = await syncPayoutRates()
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.sync_payout_rates',
      entityType: 'payout_fx_rate',
      metadata: result,
    })
    return result
  })
}
