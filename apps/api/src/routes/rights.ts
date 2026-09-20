import type { FastifyPluginAsync } from 'fastify'
import { COPYRIGHT_AUTHORIZATION_ATTESTATION, MODEL_RELEASE_ATTESTATION } from '@vuekumi/shared'
import { relatedCopyrightWhere } from '../lib/copyright.js'
import { appearanceInclude, relatedAppearanceWhere } from '../lib/models.js'
import { hashToken } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'

const copyrightInclude = {
  photo: {
    include: {
      contributor: true,
      uploadedBy: true,
    },
  },
} as const

/**
 * Phase 52 / T4 — public rights hub preview.
 * Resolves one invite token to likeness (model) or copyright (photographer).
 * Guest decide actions stay on `/api/model/invite/:token/decide` and
 * `/api/copyright/invite/:token/decide`.
 */
export const rightsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/rights/preview/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    if (!token?.trim()) {
      return reply.code(400).send({ error: 'Invite token is required' })
    }
    const tokenHash = hashToken(token)

    const appearance = await prisma.photoAppearance.findUnique({
      where: { inviteTokenHash: tokenHash },
      include: appearanceInclude,
    })
    if (appearance?.inviteExpiresAt && appearance.inviteExpiresAt >= new Date()) {
      const existing = appearance.inviteEmail
        ? await prisma.user.findUnique({ where: { email: appearance.inviteEmail.toLowerCase() } })
        : null
      const relatedWhere = relatedAppearanceWhere(appearance)
      const related = relatedWhere
        ? await prisma.photoAppearance.findMany({
            where: relatedWhere,
            include: appearanceInclude,
            orderBy: { createdAt: 'asc' },
          })
        : [appearance]
      const images = (related.length ? related : [appearance]).map((row) => ({
        appearanceId: row.id,
        photoId: row.photoId,
        photoTitle: row.photo.title,
        photoSrc:
          row.photo.storageKey && row.photo.processingStatus === 'ready'
            ? `/api/media/${row.photo.id}/preview`
            : row.photo.src,
        status: row.status,
        consentStatus: row.consentStatus,
      }))
      return {
        kind: 'likeness' as const,
        invite: {
          email: appearance.inviteEmail ?? '',
          displayName: appearance.displayName,
          photoTitle: appearance.photo.title,
          photographerName: appearance.photo.contributor.name,
          expiresAt: appearance.inviteExpiresAt.toISOString(),
          needsAccount: !existing,
          membershipRequired: false as const,
          shootTitle: appearance.photo.shoot?.title ?? null,
          shotOn: appearance.photo.shoot?.shotOn
            ? appearance.photo.shoot.shotOn.toISOString().slice(0, 10)
            : null,
          imageCount: images.length,
          images,
          terms: MODEL_RELEASE_ATTESTATION,
        },
      }
    }

    const copyright = await prisma.copyrightAuthorization.findUnique({
      where: { inviteTokenHash: tokenHash },
      include: copyrightInclude,
    })
    if (copyright?.inviteExpiresAt && copyright.inviteExpiresAt >= new Date()) {
      const existing = copyright.inviteEmail
        ? await prisma.user.findUnique({ where: { email: copyright.inviteEmail.toLowerCase() } })
        : null
      const relatedWhere = relatedCopyrightWhere(copyright)
      const related = relatedWhere
        ? await prisma.copyrightAuthorization.findMany({
            where: relatedWhere,
            include: copyrightInclude,
            orderBy: { createdAt: 'asc' },
          })
        : [copyright]
      const images = (related.length ? related : [copyright]).map((row) => ({
        authorizationId: row.id,
        photoId: row.photoId,
        photoTitle: row.photo.title,
        photoSrc:
          row.photo.storageKey && row.photo.processingStatus === 'ready'
            ? `/api/media/${row.photo.id}/preview`
            : row.photo.src,
        status: row.status,
      }))
      return {
        kind: 'copyright' as const,
        invite: {
          email: copyright.inviteEmail ?? '',
          displayName: copyright.displayName,
          photoTitle: copyright.photo.title,
          modelName: copyright.photo.uploadedBy?.name ?? copyright.photo.contributor.name,
          expiresAt: copyright.inviteExpiresAt.toISOString(),
          needsAccount: !existing,
          membershipRequired: false as const,
          imageCount: images.length,
          images,
          terms: COPYRIGHT_AUTHORIZATION_ATTESTATION,
          notice:
            'A model identified you as the photographer. This is rights clearance, not a marketing list.',
        },
      }
    }

    return reply.code(404).send({ error: 'Invite is invalid or has expired' })
  })
}
