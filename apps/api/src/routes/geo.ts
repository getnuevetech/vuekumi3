import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { pricingForCountry } from '../lib/fx.js'

export async function geoRoutes(app: FastifyInstance) {
  app.get('/geo/countries', async (request) => {
    const query = request.query as { contributors?: string }
    const where = query.contributors === '1'
      ? { enabled: true, contributorEligible: true }
      : { enabled: true }

    const countries = await prisma.country.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return { countries }
  })

  app.get('/geo/pricing', async (request) => {
    const query = request.query as { country?: string }
    const headerCountry =
      (request.headers['cf-ipcountry'] as string | undefined) ||
      (request.headers['x-vercel-ip-country'] as string | undefined) ||
      (request.headers['x-country-code'] as string | undefined)

    const country = query.country || (headerCountry && headerCountry !== 'XX' ? headerCountry : undefined)
    return pricingForCountry(country)
  })
}
