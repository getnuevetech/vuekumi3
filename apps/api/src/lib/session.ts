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

export function requestTokenMeta(request: { ip?: string; headers: { 'user-agent'?: string | string[] } }) {
  const ua = request.headers['user-agent']
  return {
    ip: request.ip,
    userAgent: Array.isArray(ua) ? ua[0] : ua,
  }
}

export async function issueTokens(
  app: FastifyInstance,
  userId: string,
  reply: FastifyReply,
  meta?: { ip?: string; userAgent?: string },
) {
  const accessToken = app.jwt.sign({ sub: userId, type: 'access' }, { expiresIn: config.accessTokenTtl })
  const refreshRaw = createToken()
  const refreshHash = hashToken(refreshRaw)
  const now = new Date()

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
      ipAddress: meta?.ip?.slice(0, 64) || null,
      userAgent: meta?.userAgent?.slice(0, 400) || null,
      lastUsedAt: now,
    },
  })

  setAuthCookies(reply, accessToken, refreshRaw)
  return { accessToken }
}
