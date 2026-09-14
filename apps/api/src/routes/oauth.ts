import type { FastifyInstance, FastifyReply } from 'fastify'
import { oauthDevSchema } from '@vuekumi/shared'
import { config } from '../config.js'
import { createToken } from '../lib/password.js'
import {
  AUTH_RATE_LIMIT,
} from '../lib/rate-limit.js'
import {
  OAuthError,
  buildGoogleAuthorizeUrl,
  devOAuthEnabled,
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleCallbackRedirectUri,
  googleOAuthCredentials,
  resolveOAuthUser,
  safeOAuthRedirect,
} from '../lib/oauth.js'
import { prisma } from '../lib/prisma.js'
import { issueTokens } from '../lib/session.js'
import { authUserInclude, serializeUser } from '../lib/serialize.js'

const STATE_COOKIE = 'oauth_state'
const REDIRECT_COOKIE = 'oauth_redirect'

function setOAuthCookies(reply: FastifyReply, state: string, redirect: string) {
  const opts = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax' as const,
    path: '/api/auth/oauth',
    maxAge: 10 * 60,
  }
  reply.setCookie(STATE_COOKIE, state, opts)
  reply.setCookie(REDIRECT_COOKIE, redirect, opts)
}

function clearOAuthCookies(reply: FastifyReply) {
  reply.clearCookie(STATE_COOKIE, { path: '/api/auth/oauth' })
  reply.clearCookie(REDIRECT_COOKIE, { path: '/api/auth/oauth' })
}

function loginRedirect(error?: string, redirect = '/') {
  const dest = new URL('/login', config.webUrl)
  if (error) dest.searchParams.set('oauth_error', error)
  else dest.searchParams.set('oauth', 'ok')
  if (redirect && redirect !== '/') dest.searchParams.set('redirect', redirect)
  return dest.toString()
}

export async function oauthRoutes(app: FastifyInstance) {
  app.get('/auth/oauth/google/start', {
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const query = request.query as { redirect?: string }
    const redirect = safeOAuthRedirect(query.redirect)
    const creds = await googleOAuthCredentials()
    if (!creds) {
      return reply.redirect(loginRedirect('not_configured', redirect))
    }

    const state = createToken()
    setOAuthCookies(reply, state, redirect)
    return reply.redirect(buildGoogleAuthorizeUrl({
      clientId: creds.clientId,
      redirectUri: googleCallbackRedirectUri(),
      state,
    }))
  })

  app.get('/auth/oauth/google/callback', {
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string }
    const expected = request.cookies[STATE_COOKIE]
    const redirect = safeOAuthRedirect(request.cookies[REDIRECT_COOKIE])
    clearOAuthCookies(reply)

    if (query.error) {
      return reply.redirect(loginRedirect('denied', redirect))
    }
    if (!query.code || !query.state || !expected || query.state !== expected) {
      return reply.redirect(loginRedirect('failed', redirect))
    }

    try {
      const creds = await googleOAuthCredentials()
      if (!creds) {
        return reply.redirect(loginRedirect('not_configured', redirect))
      }
      const accessToken = await exchangeGoogleCode(query.code, creds.clientId, creds.clientSecret)
      const profile = await fetchGoogleProfile(accessToken)
      const user = await resolveOAuthUser({
        provider: 'google',
        providerUserId: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        ipAddress: request.ip,
      })
      await issueTokens(app, user.id, reply)
      return reply.redirect(loginRedirect(undefined, redirect))
    } catch (err) {
      const code = err instanceof OAuthError ? err.code : 'failed'
      return reply.redirect(loginRedirect(code, redirect))
    }
  })

  app.post('/auth/oauth/dev', {
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    if (!(await devOAuthEnabled())) {
      return reply.code(404).send({ error: 'Not found' })
    }
    const body = oauthDevSchema.parse(request.body)
    const email = body.email.toLowerCase()
    try {
      const user = await resolveOAuthUser({
        provider: 'dev',
        providerUserId: `dev:${email}`,
        email,
        name: body.name?.trim() || email.split('@')[0] || 'Member',
        ipAddress: request.ip,
      })
      await issueTokens(app, user.id, reply)
      const full = await prisma.user.findUnique({
        where: { id: user.id },
        include: authUserInclude,
      })
      return { user: serializeUser(full!) }
    } catch (err) {
      if (err instanceof OAuthError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })
}
