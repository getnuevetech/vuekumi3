import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AccountType } from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { authUserInclude, serializeUser } from './serialize.js'

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
      include: authUserInclude,
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

export function requireAgency(fastify: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(fastify, request, reply)
    if (reply.sent) return
    if (!request.authUser?.agencyId || !request.authUser.agencyRole) {
      return reply.code(403).send({ error: 'Agency workspace required' })
    }
  }
}

/** Attach the user when a valid cookie/bearer token is present; never 401. */
export async function optionalAuthenticate(
  fastify: FastifyInstance,
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  try {
    const token =
      request.cookies.access_token ??
      (request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : undefined)
    if (!token) return

    const payload = fastify.jwt.verify<JwtPayload>(token)
    if (payload.type !== 'access') return

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: authUserInclude,
    })
    if (!user || user.status === 'suspended') return

    request.userId = user.id
    request.authUser = serializeUser(user)
  } catch {
    /* anonymous is fine */
  }
}
