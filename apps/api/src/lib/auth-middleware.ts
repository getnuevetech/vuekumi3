import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AccountType } from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { serializeUser } from './serialize.js'

export interface JwtPayload {
  sub: string
  type: 'access'
}

export async function authenticate(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const token =
      request.cookies.access_token ??
      (request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : undefined)

    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const payload = fastify.jwt.verify<JwtPayload>(token)
    if (payload.type !== 'access') {
      return reply.code(401).send({ error: 'Invalid token' })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        contributorProfile: true,
        adminProfile: true,
        agencyMembers: { where: { status: 'active' }, take: 1 },
      },
    })

    if (!user || user.status === 'suspended') {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    request.userId = user.id
    request.authUser = serializeUser(user)
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

export function requireAccountTypes(fastify: FastifyInstance, ...types: AccountType[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(fastify, request, reply)
    if (reply.sent) return
    if (!request.authUser || !types.includes(request.authUser.accountType)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
  }
}
