import type { FastifyInstance } from 'fastify'
import { recordIdentityEvidenceSchema } from '@vuekumi/shared'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import {
  IdentityVerificationError,
  getIdentityVerificationStatus,
  listIdentityEvidence,
  recordIdentityEvidence,
  startIdentityVerification,
} from '../lib/identity-verification.js'

function identityError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof IdentityVerificationError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function identityVerificationRoutes(app: FastifyInstance) {
  const auth = {
    preHandler: (request: Parameters<typeof authenticate>[1], reply: Parameters<typeof authenticate>[2]) =>
      authenticate(app, request, reply),
  }
  const staff = { preHandler: requireAccountTypes(app, 'admin') }

  app.get('/identity/verification/status', async () => getIdentityVerificationStatus())

  app.post('/identity/verification/start', auth, async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { consentVersion?: string }
      if (!body.consentVersion || typeof body.consentVersion !== 'string') {
        return reply.code(400).send({ error: 'consentVersion is required' })
      }
      await startIdentityVerification({
        subjectUserId: request.userId,
        consentVersion: body.consentVersion,
      })
      return reply.code(501).send({ error: 'Unreachable' })
    } catch (err) {
      return identityError(reply, err)
    }
  })

  app.post('/identity/verification/evidence', staff, async (request, reply) => {
    try {
      const body = recordIdentityEvidenceSchema.parse(request.body ?? {})
      const evidence = await recordIdentityEvidence({
        ...body,
        recordedById: request.userId,
      })
      return reply.code(201).send({ evidence })
    } catch (err) {
      return identityError(reply, err)
    }
  })

  app.get('/identity/verification/evidence', auth, async (request, reply) => {
    try {
      const query = request.query as { subjectUserId?: string; photoId?: string }
      const isAdmin = request.authUser?.accountType === 'admin'
      const subjectUserId = isAdmin ? query.subjectUserId : request.userId
      if (!isAdmin && query.subjectUserId && query.subjectUserId !== request.userId) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
      const items = await listIdentityEvidence({
        subjectUserId: subjectUserId ?? undefined,
        photoId: query.photoId,
      })
      return { items }
    } catch (err) {
      return identityError(reply, err)
    }
  })
}
