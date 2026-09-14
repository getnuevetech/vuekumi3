import type { FastifyInstance, FastifyReply } from 'fastify'
import { config } from '../config.js'
import { createToken, hashToken } from './password.js'
import { prisma } from './prisma.js'

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  const secure = config.cookieSecure
  reply.setCookie('access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  })
  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: config.refreshTokenDays * 24 * 60 * 60,
  })
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie('access_token', { path: '/' })
  reply.clearCookie('refresh_token', { path: '/api/auth' })
}

export async function issueTokens(
  app: FastifyInstance,
  userId: string,
  reply: FastifyReply,
) {
  const accessToken = app.jwt.sign({ sub: userId, type: 'access' }, { expiresIn: config.accessTokenTtl })
  const refreshRaw = createToken()
  const refreshHash = hashToken(refreshRaw)

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
    },
  })

  setAuthCookies(reply, accessToken, refreshRaw)
  return { accessToken }
}
