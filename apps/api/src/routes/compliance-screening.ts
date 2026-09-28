import type { FastifyInstance } from 'fastify'
import {
  COMPLIANCE_SUBJECT_TYPES,
  recordComplianceScreeningSchema,
  upsertCountryScreeningProviderSchema,
} from '@vuekumi/shared'
import { z } from 'zod'
import { authenticate, requireAccountTypes, requireAdminCapability } from '../lib/auth-middleware.js'
import {
  ComplianceScreeningError,
  getComplianceReadiness,
  getComplianceScreeningStatus,
  listComplianceScreening,
  listCountryScreeningProviders,
  recordComplianceScreening,
  startComplianceScreening,
  upsertCountryScreeningProvider,
} from '../lib/compliance-screening.js'

function screeningError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof ComplianceScreeningError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

const startScreeningBodySchema = z.object({
  subjectType: z.enum(COMPLIANCE_SUBJECT_TYPES),
  countryCode: z.string().trim().length(2).optional().nullable(),
})

export async function complianceScreeningRoutes(app: FastifyInstance) {
  const auth = {
    preHandler: (request: Parameters<typeof authenticate>[1], reply: Parameters<typeof authenticate>[2]) =>
      authenticate(app, request, reply),
  }
  const staff = { preHandler: requireAccountTypes(app, 'admin') }
  const countriesWrite = { preHandler: requireAdminCapability(app, 'geo.countries.write') }
  const countriesList = { preHandler: requireAdminCapability(app, 'geo.countries.list') }

  app.get('/compliance/screening/status', async () => getComplianceScreeningStatus())

  app.get('/admin/compliance/readiness', countriesList, async () => getComplianceReadiness())

  app.post('/compliance/screening/start', auth, async (request, reply) => {
    try {
      const body = startScreeningBodySchema.parse(request.body ?? {})
      await startComplianceScreening({
        subjectType: body.subjectType,
        subjectUserId: request.userId,
        countryCode: body.countryCode ?? null,
      })
      return reply.code(501).send({ error: 'Unreachable' })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: err.issues[0]?.message ?? 'Invalid body' })
      }
      return screeningError(reply, err)
    }
  })

  app.post('/compliance/screening/evidence', staff, async (request, reply) => {
    try {
      const body = recordComplianceScreeningSchema.parse(request.body ?? {})
      const evidence = await recordComplianceScreening({
        ...body,
        recordedById: request.userId,
      })
      return reply.code(201).send({ evidence })
    } catch (err) {
      return screeningError(reply, err)
    }
  })

  app.get('/compliance/screening/evidence', auth, async (request, reply) => {
    try {
      const query = request.query as { subjectUserId?: string; countryCode?: string }
      const isAdmin = request.authUser?.accountType === 'admin'
      const subjectUserId = isAdmin ? query.subjectUserId : request.userId
      if (!isAdmin && query.subjectUserId && query.subjectUserId !== request.userId) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
      const items = await listComplianceScreening({
        subjectUserId: subjectUserId ?? undefined,
        countryCode: query.countryCode,
      })
      return { items }
    } catch (err) {
      return screeningError(reply, err)
    }
  })

  app.get('/admin/compliance/screening/providers', countriesList, async (request) => {
    const query = request.query as { country?: string }
    const items = await listCountryScreeningProviders(query.country)
    return { items }
  })

  app.put('/admin/compliance/screening/providers', countriesWrite, async (request, reply) => {
    try {
      const body = upsertCountryScreeningProviderSchema.parse(request.body ?? {})
      const slot = await upsertCountryScreeningProvider(body)
      return { slot }
    } catch (err) {
      return screeningError(reply, err)
    }
  })
}
