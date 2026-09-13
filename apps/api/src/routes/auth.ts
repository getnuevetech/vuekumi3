import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import {
  adminPasswordResetEmail,
  passwordResetEmail,
  sendEmail,
  verifyEmail as verifyEmailTemplate,
} from '../lib/email.js'
import { hashPassword, createToken, hashToken, verifyPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { serializeUser } from '../lib/serialize.js'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'

const PLATFORM_AGREEMENT_VERSION = '1.0'

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  const secure = !config.isDev
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

function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie('access_token', { path: '/' })
  reply.clearCookie('refresh_token', { path: '/api/auth' })
}

async function issueTokens(
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
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' })
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
          country: body.country,
          status,
        },
      })

      if (body.accountType === 'contributor') {
        const handle = body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        await tx.contributorProfile.create({
          data: {
            userId: created.id,
            handle: `${handle}-${created.id.slice(-4)}`,
            location: body.country,
          },
        })
        await tx.platformAgreement.create({
          data: { userId: created.id, version: PLATFORM_AGREEMENT_VERSION },
        })
      }

      if (body.accountType === 'user') {
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
    await issueTokens(app, user.id, reply)

    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        contributorProfile: true,
        adminProfile: true,
        agencyMembers: { take: 1 },
      },
    })

    return {
      user: serializeUser(full!),
      ...(config.isDev ? { devVerifyToken: verifyToken } : {}),
    }
  })

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        contributorProfile: true,
        adminProfile: true,
        agencyMembers: { take: 1 },
      },
    })

    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }
    if (user.status === 'suspended') {
      return reply.code(403).send({ error: 'Account suspended' })
    }

    await issueTokens(app, user.id, reply)
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
    await issueTokens(app, stored.userId, reply)
    return { ok: true }
  })

  app.get('/auth/me', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    return { user: request.authUser }
  })

  app.post('/auth/forgot-password', async (request, reply) => {
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

  app.post('/auth/reset-password/:token', async (request, reply) => {
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
