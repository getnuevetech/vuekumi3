import type { FastifyInstance } from 'fastify'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import {
  isCurrentRefreshToken,
  normalizeHandle,
  passwordChangeBlocked,
  summarizeUserAgent,
} from '../lib/account.js'
import { creatorKindChange, registrationCreatorKind } from '../lib/creator-kind.js'
import { handleTaken } from '../lib/models.js'
import {
  adminPasswordResetEmail,
  passwordResetEmail,
  sendEmail,
  verifyEmail as verifyEmailTemplate,
} from '../lib/email.js'
import { hashPassword, createToken, hashToken, verifyPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { AUTH_RATE_LIMIT } from '../lib/rate-limit.js'
import { serializeUser, authUserInclude } from '../lib/serialize.js'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import { assertContributorCountry } from '../lib/geo.js'
import { clearAuthCookies, issueTokens } from '../lib/session.js'

import { agreementVersionForAccountType } from '../data/licenses.js'

async function createEmailVerification(userId: string, email: string, name: string) {
  const raw = createToken()
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + config.verifyTokenHours * 60 * 60 * 1000),
    },
  })
  const link = `${config.webUrl}/verify-email/${raw}`
  await sendEmail({
    to: email,
    subject: 'Verify your Vuekumi email',
    html: verifyEmailTemplate(name, link),
  })
  return raw
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', {
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' })
    }

    if (body.accountType === 'photographer' || body.accountType === 'contributor') {
      if (!body.acceptAgreement) {
        return reply.code(400).send({
          error: body.accountType === 'photographer'
            ? 'Photographers must accept the VueKumi photographer licensing agreement'
            : 'Community contributors must accept the VueKumi community contributor terms',
        })
      }
      try {
        await assertContributorCountry(body.country)
      } catch (err) {
        const e = err as Error & { statusCode?: number }
        return reply.code(e.statusCode ?? 400).send({ error: e.message })
      }
    }

    const passwordHash = await hashPassword(body.password)
    const status = body.accountType === 'agency' ? 'pending' : 'active'

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: body.email.toLowerCase(),
          passwordHash,
          name: body.name,
          accountType: body.accountType,
          country: body.country?.toUpperCase(),
          status,
        },
      })

      if (body.accountType === 'photographer' || body.accountType === 'contributor') {
        const handle = body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        await tx.contributorProfile.create({
          data: {
            userId: created.id,
            handle: `${handle}-${created.id.slice(-4)}`,
            location: body.country,
            creatorKind: registrationCreatorKind(body.accountType, body.creatorKind) ?? 'photographer',
          },
        })
        await tx.platformAgreement.create({
          data: { userId: created.id, version: agreementVersionForAccountType(body.accountType) },
        })
      }

      if (body.accountType === 'user' || body.accountType === 'agency') {
        await tx.userProfile.create({ data: { userId: created.id } })
      }

      if (body.accountType === 'agency') {
        const slug = body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        const agency = await tx.agency.create({
          data: {
            name: body.name,
            slug: `${slug}-${created.id.slice(-4)}`,
            ownerUserId: created.id,
            status: 'pending',
            billingEmail: body.email.toLowerCase(),
          },
        })
        await tx.agencyMember.create({
          data: { agencyId: agency.id, userId: created.id, agencyRole: 'owner' },
        })
      }

      return created
    })

    const verifyToken = await createEmailVerification(user.id, user.email, user.name)
    await issueTokens(app, user.id, reply, request)

    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: authUserInclude,
    })

    return {
      user: serializeUser(full!),
      ...(config.isDev ? { devVerifyToken: verifyToken } : {}),
    }
  })

  app.post('/auth/login', {
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: authUserInclude,
    })

    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }
    if (user.status === 'suspended') {
      return reply.code(403).send({ error: 'Account suspended' })
    }

    await issueTokens(app, user.id, reply, request)
    return { user: serializeUser(user) }
  })

  app.post('/auth/logout', async (request, reply) => {
    const refresh = request.cookies.refresh_token
    if (refresh) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refresh) } })
    }
    clearAuthCookies(reply)
    return { ok: true }
  })

  app.post('/auth/refresh', async (request, reply) => {
    const refresh = request.cookies.refresh_token
    if (!refresh) return reply.code(401).send({ error: 'No refresh token' })

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refresh) } })
    if (!stored || stored.expiresAt < new Date()) {
      clearAuthCookies(reply)
      return reply.code(401).send({ error: 'Refresh token expired' })
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } })
    await issueTokens(app, stored.userId, reply, request)
    return { ok: true }
  })

  app.get('/auth/me', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    return { user: request.authUser }
  })

  app.patch('/auth/me', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const body = updateProfileSchema.parse(request.body)
    const userId = request.userId!
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { contributorProfile: true, modelProfile: true },
    })
    if (!existing) return reply.code(401).send({ error: 'Unauthorized' })

    let country = existing.country
    if (body.country !== undefined) {
      country = body.country ? body.country.toUpperCase() : null
      if ((existing.accountType === 'contributor' || existing.accountType === 'photographer') && country) {
        try {
          await assertContributorCountry(country)
        } catch (err) {
          const e = err as Error & { statusCode?: number }
          return reply.code(e.statusCode ?? 400).send({ error: e.message })
        }
      }
    }

    let handle = existing.contributorProfile?.handle ?? existing.modelProfile?.handle
    if (body.handle && (existing.accountType === 'contributor' || existing.accountType === 'photographer' || existing.accountType === 'model')) {
      const normalized = normalizeHandle(body.handle)
      if ('error' in normalized) {
        return reply.code(400).send({ error: normalized.error })
      }
      if (await handleTaken(normalized.handle, userId)) {
        return reply.code(409).send({ error: 'That handle is already taken' })
      }
      handle = normalized.handle
    }

    const avatarUrl =
      body.avatarUrl === undefined ? existing.avatarUrl : body.avatarUrl.trim() || null

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          country,
          avatarUrl,
        },
      })
      const availabilityData = {
        ...(body.availability ? { availability: body.availability } : {}),
        ...(body.dayRateUsd !== undefined ? { dayRateUsd: body.dayRateUsd } : {}),
      }
      if (existing.contributorProfile) {
        const nextKind = creatorKindChange(true, body.creatorKind)
        await tx.contributorProfile.update({
          where: { userId },
          data: {
            ...(handle ? { handle } : {}),
            ...(body.bio !== undefined ? { bio: body.bio.trim() || null } : {}),
            ...(body.location !== undefined ? { location: body.location.trim() || null } : {}),
            ...(nextKind ? { creatorKind: nextKind } : {}),
            ...availabilityData,
          },
        })
      }
      if (existing.modelProfile) {
        await tx.modelProfile.update({
          where: { userId },
          data: {
            ...(handle ? { handle } : {}),
            ...(body.bio !== undefined ? { bio: body.bio.trim() || null } : {}),
            ...(body.location !== undefined ? { location: body.location.trim() || null } : {}),
            ...availabilityData,
          },
        })
      }
    })

    await writeAuditLog({
      actorId: userId,
      action: 'account.update_profile',
      entityType: 'user',
      entityId: userId,
      ipAddress: request.ip,
    })

    const full = await prisma.user.findUnique({
      where: { id: userId },
      include: authUserInclude,
    })
    return { user: serializeUser(full!) }
  })

  app.patch('/auth/me/password', {
    preHandler: (request, reply) => authenticate(app, request, reply),
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { id: request.userId! } })
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })

    const blocked = passwordChangeBlocked({
      hasPassword: Boolean(user.passwordHash),
      currentPassword: body.currentPassword,
    })
    if (blocked) {
      return reply.code(blocked.status).send({ error: blocked.error })
    }

    if (user.passwordHash) {
      const ok = await verifyPassword(body.currentPassword!, user.passwordHash)
      if (!ok) {
        return reply.code(401).send({ error: 'Current password is incorrect' })
      }
    }

    const passwordHash = await hashPassword(body.password)
    const currentHash = request.cookies.refresh_token ? hashToken(request.cookies.refresh_token) : null
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.deleteMany({
        where: {
          userId: user.id,
          ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
        },
      }),
    ])

    await writeAuditLog({
      actorId: user.id,
      action: 'account.change_password',
      entityType: 'user',
      entityId: user.id,
      ipAddress: request.ip,
    })

    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: authUserInclude,
    })
    return { user: serializeUser(full!) }
  })

  app.get('/auth/sessions', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const rows = await prisma.refreshToken.findMany({
      where: { userId: request.userId!, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    })
    const cookie = request.cookies.refresh_token
    return {
      items: rows.map((row) => ({
        id: row.id,
        current: isCurrentRefreshToken(cookie, row.tokenHash, hashToken),
        ipAddress: row.ipAddress,
        device: summarizeUserAgent(row.userAgent),
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
    }
  })

  app.post('/auth/sessions/revoke-others', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const cookie = request.cookies.refresh_token
    const currentHash = cookie ? hashToken(cookie) : null
    const result = await prisma.refreshToken.deleteMany({
      where: {
        userId: request.userId!,
        ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
      },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'account.revoke_other_sessions',
      entityType: 'user',
      entityId: request.userId,
      ipAddress: request.ip,
      metadata: { count: result.count },
    })
    return { ok: true, revoked: result.count }
  })

  app.delete('/auth/sessions/:id', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await prisma.refreshToken.findFirst({
      where: { id, userId: request.userId! },
    })
    if (!row) return reply.code(404).send({ error: 'Session not found' })

    const current = isCurrentRefreshToken(request.cookies.refresh_token, row.tokenHash, hashToken)
    await prisma.refreshToken.delete({ where: { id: row.id } })
    if (current) clearAuthCookies(reply)
    return { ok: true, current }
  })

  app.post('/auth/forgot-password', {
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const { email } = forgotPasswordSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) return { ok: true }

    const recent = await prisma.passwordResetToken.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    if (recent >= 3) {
      return reply.code(429).send({ error: 'Too many reset requests. Try again later.' })
    }

    const raw = createToken()
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + config.resetTokenHours * 60 * 60 * 1000),
        initiatedBy: 'self',
      },
    })

    const link = `${config.webUrl}/reset-password/${raw}`
    await sendEmail({
      to: user.email,
      subject: 'Reset your Vuekumi password',
      html: passwordResetEmail(user.name, link),
    })

    return { ok: true, ...(config.isDev ? { devResetToken: raw } : {}) }
  })

  app.post('/auth/reset-password/:token', {
    config: { rateLimit: AUTH_RATE_LIMIT },
  }, async (request, reply) => {
    const { token } = request.params as { token: string }
    const body = resetPasswordSchema.parse(request.body)

    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } })
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired reset token' })
    }

    const passwordHash = await hashPassword(body.password)
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ])

    return { ok: true }
  })

  app.get('/auth/verify-email/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    })
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired verification token' })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])

    return { ok: true }
  })

  app.post('/auth/admin/send-password-reset/:userId', {
    preHandler: requireAccountTypes(app, 'admin'),
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const target = await prisma.user.findUnique({ where: { id: userId } })
    if (!target) return reply.code(404).send({ error: 'User not found' })

    const recent = await prisma.passwordResetToken.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    if (recent >= 3) {
      return reply.code(429).send({ error: 'Too many reset requests for this user.' })
    }

    const raw = createToken()
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + config.resetTokenHours * 60 * 60 * 1000),
        initiatedBy: 'admin',
        adminId: request.userId,
      },
    })

    const link = `${config.webUrl}/reset-password/${raw}`
    await sendEmail({
      to: target.email,
      subject: 'Vuekumi password reset requested',
      html: adminPasswordResetEmail(target.name, link),
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.send_password_reset',
      entityType: 'user',
      entityId: userId,
      ipAddress: request.ip,
    })

    return { ok: true, ...(config.isDev ? { devResetToken: raw } : {}) }
  })
}
