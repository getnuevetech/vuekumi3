import { joinDisplayName, splitDisplayName } from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from './audit.js'
import { prisma } from './prisma.js'
import { getSettingSafe } from './settings.js'

export class OAuthError extends Error {
  statusCode: number
  code: string

  constructor(message: string, code: string, statusCode = 400) {
    super(message)
    this.name = 'OAuthError'
    this.code = code
    this.statusCode = statusCode
  }
}

export type OAuthDecision =
  | { action: 'reuse'; userId: string }
  | { action: 'link'; userId: string }
  | { action: 'create' }
  | { action: 'reject'; error: 'suspended'; userId?: string }

export function decideOAuthIdentity(input: {
  linkedUser: { id: string; status: string } | null
  emailUser: { id: string; status: string } | null
}): OAuthDecision {
  if (input.linkedUser) {
    if (input.linkedUser.status === 'suspended') {
      return { action: 'reject', error: 'suspended', userId: input.linkedUser.id }
    }
    return { action: 'reuse', userId: input.linkedUser.id }
  }
  if (input.emailUser) {
    if (input.emailUser.status === 'suspended') {
      return { action: 'reject', error: 'suspended', userId: input.emailUser.id }
    }
    return { action: 'link', userId: input.emailUser.id }
  }
  return { action: 'create' }
}

export function safeOAuthRedirect(value: string | undefined | null): string {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  if (value.includes('\\') || value.includes('://')) return '/'
  return value
}

export function googleCallbackRedirectUri(): string {
  return `${config.webUrl.replace(/\/$/, '')}/api/auth/oauth/google/callback`
}

export function buildGoogleAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', input.state)
  url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

export async function googleOAuthCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const clientId = (await getSettingSafe('auth.google_client_id'))?.trim() ?? ''
  const clientSecret = (await getSettingSafe('auth.google_client_secret'))?.trim() ?? ''
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export async function googleOAuthConfigured(): Promise<boolean> {
  return Boolean(await googleOAuthCredentials())
}

export async function devOAuthEnabled(): Promise<boolean> {
  return config.isDev && !(await googleOAuthConfigured())
}

export async function exchangeGoogleCode(code: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleCallbackRedirectUri(),
    grant_type: 'authorization_code',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new OAuthError('Google token exchange failed', 'failed', 401)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new OAuthError('Google token missing', 'failed', 401)
  }
  return json.access_token
}

export async function fetchGoogleProfile(accessToken: string): Promise<{
  id: string
  email: string
  verified: boolean
  name: string
  picture?: string
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new OAuthError('Google profile failed', 'failed', 401)
  }
  const json = (await res.json()) as {
    id?: string
    email?: string
    verified_email?: boolean
    name?: string
    picture?: string
  }
  if (!json.id || !json.email) {
    throw new OAuthError('Google profile incomplete', 'failed', 401)
  }
  if (!json.verified_email) {
    throw new OAuthError('Google email is not verified', 'unverified', 403)
  }
  return {
    id: json.id,
    email: json.email.toLowerCase(),
    verified: true,
    name: json.name?.trim() || json.email.split('@')[0] || 'Member',
    picture: json.picture,
  }
}

export async function resolveOAuthUser(input: {
  provider: string
  providerUserId: string
  email: string
  name: string
  picture?: string
  ipAddress?: string
}): Promise<{ id: string; created: boolean }> {
  const email = input.email.toLowerCase()
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    },
    include: { user: true },
  })
  const emailUser = linked
    ? null
    : await prisma.user.findUnique({ where: { email } })

  const decision = decideOAuthIdentity({
    linkedUser: linked ? { id: linked.user.id, status: linked.user.status } : null,
    emailUser: emailUser ? { id: emailUser.id, status: emailUser.status } : null,
  })

  if (decision.action === 'reject') {
    throw new OAuthError('Account suspended', 'suspended', 403)
  }

  if (decision.action === 'reuse') {
    await writeAuditLog({
      actorId: decision.userId,
      action: 'auth.oauth_login',
      entityType: 'user',
      entityId: decision.userId,
      metadata: { provider: input.provider },
      ipAddress: input.ipAddress,
    })
    return { id: decision.userId, created: false }
  }

  if (decision.action === 'link') {
    await prisma.$transaction(async (tx) => {
      await tx.oAuthAccount.create({
        data: {
          userId: decision.userId,
          provider: input.provider,
          providerUserId: input.providerUserId,
          email,
        },
      })
      const current = await tx.user.findUnique({ where: { id: decision.userId } })
      await tx.user.update({
        where: { id: decision.userId },
        data: {
          emailVerifiedAt: current?.emailVerifiedAt ?? new Date(),
          avatarUrl: current?.avatarUrl || input.picture || undefined,
        },
      })
    })
    await writeAuditLog({
      actorId: decision.userId,
      action: 'auth.oauth_link',
      entityType: 'user',
      entityId: decision.userId,
      metadata: { provider: input.provider },
      ipAddress: input.ipAddress,
    })
    return { id: decision.userId, created: false }
  }

  const created = await prisma.$transaction(async (tx) => {
    const parts = splitDisplayName(input.name?.trim() || email.split('@')[0])
    const user = await tx.user.create({
      data: {
        email,
        name: joinDisplayName(parts.firstName, parts.lastName) || parts.firstName,
        firstName: parts.firstName,
        lastName: parts.lastName,
        accountType: 'user',
        status: 'active',
        avatarUrl: input.picture,
        emailVerifiedAt: new Date(),
      },
    })
    await tx.userProfile.create({ data: { userId: user.id } })
    await tx.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: input.provider,
        providerUserId: input.providerUserId,
        email,
      },
    })
    return user
  })

  await writeAuditLog({
    actorId: created.id,
    action: 'auth.oauth_register',
    entityType: 'user',
    entityId: created.id,
    metadata: { provider: input.provider },
    ipAddress: input.ipAddress,
  })

  return { id: created.id, created: true }
}
