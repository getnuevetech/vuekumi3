import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  CONSENT_VERSION,
  acceptModelInviteSchema,
  decideAppearanceSchema,
  verifyLikenessSchema,
} from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import { optionalAuthenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import { modelInviteEmail, sendEmail } from '../lib/email.js'
import {
  ModelError,
  MODEL_INVITE_DAYS,
  appearanceInclude,
  appearanceUnclaimed,
  claimPendingForEmail,
  decideAppearanceBlocked,
  ensureModelProfile,
  modelAccountBlocked,
  serializeAppearance,
  syncPermissionToTwoParty,
} from '../lib/models.js'
import { createToken, hashPassword, hashToken } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { issueTokens } from '../lib/session.js'
import { authUserInclude, serializeUser } from '../lib/serialize.js'
import {
  compareLikeness,
  decodeReferenceImage,
  likenessCheckBlocked,
  loadPhotographBytes,
} from '../lib/likeness.js'

function modelError(reply: FastifyReply, err: unknown) {
  if (err instanceof ModelError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function issueAppearanceInvite(appearanceId: string) {
  const raw = createToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + MODEL_INVITE_DAYS * 24 * 60 * 60 * 1000)
  const updated = await prisma.photoAppearance.update({
    where: { id: appearanceId },
    data: {
      status: 'invited',
      inviteTokenHash: hashToken(raw),
      inviteExpiresAt: expiresAt,
      invitedAt: now,
    },
    include: appearanceInclude,
  })
  const joinUrl = `${config.webUrl}/invite/model/${raw}`
  if (updated.inviteEmail) {
    await sendEmail({
      to: updated.inviteEmail,
      subject: `${updated.photo.contributor.name} invited you to confirm a Vuekumi photograph`,
      html: modelInviteEmail({
        displayName: updated.displayName,
        photographerName: updated.photo.contributor.name,
        photoTitle: updated.photo.title,
        link: joinUrl,
      }),
    })
  }
  return { appearance: updated, joinUrl, raw }
}

export async function modelRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAccountTypes(app, 'model') }

  app.get('/model', gate, async (request) => {
    const userId = request.userId!
    const [profile, counts] = await Promise.all([
      prisma.modelProfile.findUnique({ where: { userId } }),
      prisma.photoAppearance.groupBy({
        by: ['status'],
        where: { modelUserId: userId },
        _count: { _all: true },
      }),
    ])
    const byStatus = Object.fromEntries(counts.map((row) => [row.status, row._count._all]))
    return {
      handle: profile?.handle ?? null,
      location: profile?.location ?? null,
      bio: profile?.bio ?? null,
      earns: false,
      counts: {
        invited: byStatus.invited ?? 0,
        claimed: byStatus.claimed ?? 0,
        approved: byStatus.approved ?? 0,
        rejected: byStatus.rejected ?? 0,
        total: counts.reduce((sum, row) => sum + row._count._all, 0),
      },
    }
  })

  app.get('/model/appearances', gate, async (request) => {
    const items = await prisma.photoAppearance.findMany({
      where: { modelUserId: request.userId },
      include: appearanceInclude,
      orderBy: { updatedAt: 'desc' },
    })
    return { items: items.map((row) => serializeAppearance(row, { includeEmail: false, includeVerification: true })) }
  })

  app.post('/model/appearances/:id/decide', gate, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = decideAppearanceSchema.parse(request.body)
      const blocked = decideAppearanceBlocked(body)
      if (blocked) throw new ModelError(blocked)
      const row = await prisma.photoAppearance.findUnique({ where: { id } })
      if (!row || row.modelUserId !== request.userId) {
        throw new ModelError('Appearance not found', 404)
      }
      if (appearanceUnclaimed(row.status)) {
        throw new ModelError('Claim this invite before deciding')
      }
      const usage = body.status === 'approved' ? body.usage! : (body.usage ?? 'none')
      const updated = await prisma.photoAppearance.update({
        where: { id },
        data: {
          status: body.status,
          confirmedLikeness: body.confirmedLikeness,
          usage,
          notes: body.notes ?? row.notes,
          decidedAt: new Date(),
          consentVersion: body.status === 'approved' ? CONSENT_VERSION : null,
        },
        include: appearanceInclude,
      })
      await syncPermissionToTwoParty(row.photoId)
      await writeAuditLog({
        actorId: request.userId,
        action: body.status === 'approved' ? 'model.photo_approve' : 'model.photo_reject',
        entityType: 'photo_appearance',
        entityId: id,
        metadata: {
          photoId: row.photoId,
          confirmedLikeness: body.confirmedLikeness,
          usage,
          consentVersion: body.status === 'approved' ? CONSENT_VERSION : null,
        },
        ipAddress: request.ip,
      })
      return { appearance: serializeAppearance(updated, { includeEmail: false, includeVerification: true }) }
    } catch (err) {
      return modelError(reply, err)
    }
  })

  app.post('/model/appearances/:id/verify', gate, async (request, reply) => {
    let selfie: Buffer | null = null
    try {
      const { id } = request.params as { id: string }
      const body = verifyLikenessSchema.parse(request.body)
      const row = await prisma.photoAppearance.findUnique({
        where: { id },
        include: {
          photo: { include: { assets: true, contributor: true } },
        },
      })
      if (!row || row.modelUserId !== request.userId) {
        throw new ModelError('Appearance not found', 404)
      }
      const blocked = likenessCheckBlocked({
        consented: body.consented,
        claimed: !appearanceUnclaimed(row.status),
      })
      if (blocked) throw new ModelError(blocked)

      selfie = decodeReferenceImage(body.imageBase64)
      const photograph = await loadPhotographBytes(row.photo)
      const verdict = await compareLikeness({ photograph, selfie })
      selfie.fill(0)
      selfie = null

      const now = new Date()
      await prisma.likenessCheck.create({
        data: {
          appearanceId: row.id,
          modelUserId: request.userId!,
          photoId: row.photoId,
          status: verdict.status,
          consentedAt: now,
          comparedAt: now,
          provider: verdict.provider,
          referenceDeletedAt: now,
          notes: verdict.notes,
        },
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'model.likeness_check',
        entityType: 'photo_appearance',
        entityId: id,
        metadata: {
          photoId: row.photoId,
          status: verdict.status,
          provider: verdict.provider,
          referenceDeleted: true,
        },
        ipAddress: request.ip,
      })
      const updated = await prisma.photoAppearance.findUnique({
        where: { id },
        include: appearanceInclude,
      })
      return { appearance: serializeAppearance(updated!, { includeEmail: false, includeVerification: true }) }
    } catch (err) {
      if (selfie) selfie.fill(0)
      return modelError(reply, err)
    }
  })

  app.get('/model/invite/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const invite = await prisma.photoAppearance.findUnique({
      where: { inviteTokenHash: hashToken(token) },
      include: appearanceInclude,
    })
    if (!invite || invite.claimedAt || !invite.inviteExpiresAt || invite.inviteExpiresAt < new Date()) {
      return reply.code(404).send({ error: 'Invite is invalid or has expired' })
    }
    const existing = invite.inviteEmail
      ? await prisma.user.findUnique({ where: { email: invite.inviteEmail.toLowerCase() } })
      : null
    return {
      invite: {
        email: invite.inviteEmail ?? '',
        displayName: invite.displayName,
        photoTitle: invite.photo.title,
        photographerName: invite.photo.contributor.name,
        expiresAt: invite.inviteExpiresAt.toISOString(),
        needsAccount: !existing,
      },
    }
  })

  app.post('/model/invite/:token', async (request, reply) => {
    try {
      const { token } = request.params as { token: string }
      const body = acceptModelInviteSchema.parse(request.body ?? {})
      const invite = await prisma.photoAppearance.findUnique({
        where: { inviteTokenHash: hashToken(token) },
        include: appearanceInclude,
      })
      if (!invite || invite.claimedAt || !invite.inviteExpiresAt || invite.inviteExpiresAt < new Date()) {
        throw new ModelError('Invite is invalid or has expired', 404)
      }
      if (!invite.inviteEmail) {
        throw new ModelError('Invite is missing an email', 400)
      }

      await optionalAuthenticate(app, request, reply)

      let user = await prisma.user.findUnique({ where: { email: invite.inviteEmail.toLowerCase() } })
      if (user) {
        if (!request.authUser || request.authUser.email.toLowerCase() !== invite.inviteEmail.toLowerCase()) {
          return reply.code(401).send({ error: 'Sign in with the invited email to claim this profile' })
        }
        const blocked = modelAccountBlocked(user.accountType)
        if (blocked) throw new ModelError(blocked, 403)
        if (user.accountType === 'user') {
          await prisma.user.update({ where: { id: user.id }, data: { accountType: 'model' } })
        }
      } else {
        if (!body.name || !body.password) {
          throw new ModelError('Name and password are required to create your account')
        }
        user = await prisma.user.create({
          data: {
            email: invite.inviteEmail.toLowerCase(),
            passwordHash: await hashPassword(body.password),
            name: body.name,
            accountType: 'model',
            status: 'active',
            emailVerifiedAt: new Date(),
          },
        })
      }

      await ensureModelProfile(user.id, user.name)
      await claimPendingForEmail(user.id, invite.inviteEmail)
      await issueTokens(app, user.id, reply, request)
      const full = await prisma.user.findUnique({
        where: { id: user.id },
        include: authUserInclude,
      })
      await writeAuditLog({
        actorId: user.id,
        action: 'model.invite_accept',
        entityType: 'photo_appearance',
        entityId: invite.id,
        metadata: { photoId: invite.photoId, email: invite.inviteEmail },
        ipAddress: request.ip,
      })
      return { user: serializeUser(full!) }
    } catch (err) {
      return modelError(reply, err)
    }
  })
}
