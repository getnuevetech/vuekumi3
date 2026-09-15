import type { FastifyInstance, FastifyReply } from 'fastify'
import { config } from '../config.js'
import { createToken, hashToken } from './password.js'
import { prisma } from './prisma.js'

/** Secure cookies only when this request is actually HTTPS. WEB_URL=https on an HTTP-only host drops the session. */
export function cookieSecureFromRequest(request: { protocol?: string }): boolean {
  return request.protocol === 'https'
}

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
  request: { protocol?: string },
) {
  const secure = cookieSecureFromRequest(request)
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
  request: { ip?: string; protocol?: string; headers: { 'user-agent'?: string | string[] } },
) {
  const meta = requestTokenMeta(request)
  const accessToken = app.jwt.sign({ sub: userId, type: 'access' }, { expiresIn: config.accessTokenTtl })
  const refreshRaw = createToken()
  const refreshHash = hashToken(refreshRaw)
  const now = new Date()

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000),
      ipAddress: meta.ip?.slice(0, 64) || null,
      userAgent: meta.userAgent?.slice(0, 400) || null,
      lastUsedAt: now,
    },
  })

  setAuthCookies(reply, accessToken, refreshRaw, request)
  return { accessToken }
}
