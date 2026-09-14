import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok', service: 'vuekumi-api' }))

  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ok', service: 'vuekumi-api' }
    } catch (err) {
      requestLog(app, err)
      return reply.code(503).send({ status: 'unready', service: 'vuekumi-api' })
    }
  })
}

function requestLog(app: FastifyInstance, err: unknown) {
  app.log.warn({ err }, 'readiness check failed')
}
