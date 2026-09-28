import type { FastifyInstance } from 'fastify'
import {
  counterCompensationSchema,
  proposeCompensationSchema,
} from '@vuekumi/shared'
import { authenticate } from '../lib/auth-middleware.js'
import {
  CompensationError,
  acceptCompensation,
  activateCompensation,
  counterCompensation,
  declineCompensation,
  listCompensationProposals,
  proposeCompensation,
} from '../lib/compensation.js'
import { prisma } from '../lib/prisma.js'

function compensationError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof CompensationError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function compensationRoutes(app: FastifyInstance) {
  const auth = { preHandler: (request: Parameters<typeof authenticate>[1], reply: Parameters<typeof authenticate>[2]) => authenticate(app, request, reply) }

  app.get('/photos/:photoId/compensation', auth, async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true, contributorId: true, appearances: { select: { modelUserId: true } } },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    const userId = request.userId!
    const allowed =
      photo.contributorId === userId
      || photo.appearances.some((row) => row.modelUserId === userId)
      || request.authUser?.accountType === 'admin'
    if (!allowed) return reply.code(403).send({ error: 'Forbidden' })
    return { items: await listCompensationProposals(photoId) }
  })

  app.post('/appearances/:appearanceId/compensation', auth, async (request, reply) => {
    try {
      const { appearanceId } = request.params as { appearanceId: string }
      const body = proposeCompensationSchema.parse(request.body ?? {})
      const proposal = await proposeCompensation({
        appearanceId,
        actorId: request.userId!,
        terms: body,
      })
      return reply.code(201).send({ proposal })
    } catch (err) {
      return compensationError(reply, err)
    }
  })

  app.post('/compensation/:proposalId/counter', auth, async (request, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string }
      const body = counterCompensationSchema.parse(request.body ?? {})
      const proposal = await counterCompensation({
        proposalId,
        actorId: request.userId!,
        terms: body,
      })
      return { proposal }
    } catch (err) {
      return compensationError(reply, err)
    }
  })

  app.post('/compensation/:proposalId/accept', auth, async (request, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string }
      const proposal = await acceptCompensation({ proposalId, actorId: request.userId! })
      return { proposal }
    } catch (err) {
      return compensationError(reply, err)
    }
  })

  app.post('/compensation/:proposalId/decline', auth, async (request, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string }
      const proposal = await declineCompensation({ proposalId, actorId: request.userId! })
      return { proposal }
    } catch (err) {
      return compensationError(reply, err)
    }
  })

  app.post('/compensation/:proposalId/activate', auth, async (request, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string }
      const proposal = await activateCompensation({ proposalId, actorId: request.userId! })
      return { proposal }
    } catch (err) {
      return compensationError(reply, err)
    }
  })
}
