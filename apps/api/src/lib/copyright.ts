import type {
  AppearanceDecisionKind,
  CopyrightAuthorizationDto,
  CopyrightAuthorizationStatus,
  CopyrightStatus,
  ModelUsagePreference,
} from '@vuekumi/shared'
import { COPYRIGHT_AUTHORIZATION_TERMS_VERSION } from '@vuekumi/shared'
import type { CopyrightAuthorization } from '@prisma/client'
import { prisma } from './prisma.js'
import { appendRightsLedgerEvent } from './ledger.js'
import { holdAvailableEarnings } from './holds.js'
import { MODEL_INVITE_DAYS, ModelError, appearanceStatusForDecision, syncVerifiedRightsRecord } from './models.js'
import { CURRENT_AGREEMENT_VERSION } from '../data/licenses.js'
import { config } from '../config.js'
import { photographerRightsNoticeEmail, sendEmail } from './email.js'
import { createToken, hashToken } from './password.js'

export const copyrightInclude = {
  photo: { include: { uploadedBy: true, contributor: true, assets: true, rightsRecord: true } },
  photographerUser: { include: { contributorProfile: true } },
} as const

export function copyrightCommercialScopeFromRows(
  rows: { commercialSublicensing: boolean; status: string; quality: string }[],
): boolean {
  return rows.some((row) =>
    row.status === 'approved'
    && row.commercialSublicensing
    && row.quality === 'verified',
  )
}

export function serializeCopyrightAuthorization(
  row: CopyrightAuthorization & {
    photo?: {
      id: string
      title: string
      src: string
      storageKey?: string | null
      processingStatus?: string | null
      uploadedBy?: { name: string } | null
    } | null
  },
  opts?: { includeEmail?: boolean; includeMobile?: boolean },
): CopyrightAuthorizationDto {
  const photo = row.photo
  const src =
    photo?.storageKey && photo.processingStatus === 'ready'
      ? `/api/media/${photo.id}/preview`
      : photo?.src
  return {
    id: row.id,
    photoId: row.photoId,
    photoTitle: photo?.title,
    photoSrc: src,
    modelName: photo?.uploadedBy?.name,
    displayName: row.displayName,
    inviteEmail: opts?.includeEmail ? row.inviteEmail : undefined,
    inviteMobile: opts?.includeMobile ? row.inviteMobile : undefined,
    status: row.status as CopyrightAuthorizationStatus,
    decisionKind: row.decisionKind,
    usage: row.usage,
    portfolioDisplay: row.portfolioDisplay,
    commercialSublicensing: row.commercialSublicensing,
    quality: row.quality,
    documentFileName: row.documentFileName,
    invitedAt: row.invitedAt ? row.invitedAt.toISOString() : null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    inviteExpiresAt: row.inviteExpiresAt ? row.inviteExpiresAt.toISOString() : null,
  }
}

export function decideCopyrightBlocked(input: {
  confirmedIdentity: boolean
  action: AppearanceDecisionKind
  usage?: ModelUsagePreference | null
  acceptAuthorizationTerms?: boolean
}): string | null {
  if (input.action === 'approved' && !input.confirmedIdentity) {
    return 'Approving usage requires confirming you are the copyright holder VueKumi contacted'
  }
  if (input.action === 'approved' && (!input.usage || input.usage === 'none')) {
    return 'Choose display (editorial) or commercial sublicensing when you approve'
  }
  if (input.action === 'approved' && !input.acceptAuthorizationTerms) {
    return 'Accept the copyright authorization terms for the images you approve'
  }
  if ((input.action === 'not_me' || input.action === 'unauthorized') && input.confirmedIdentity) {
    return 'Do not confirm you are the copyright holder if this is not you or the submission is unauthorized'
  }
  return null
}

export async function applyCopyrightDecision(input: {
  authorizationId: string
  action: AppearanceDecisionKind
  confirmedIdentity: boolean
  usage?: ModelUsagePreference | null
  notes?: string | null
  actorId?: string | null
  acceptAuthorizationTerms?: boolean
}) {
  const row = await prisma.copyrightAuthorization.findUnique({
    where: { id: input.authorizationId },
    include: copyrightInclude,
  })
  if (!row) throw new ModelError('Copyright authorization not found', 404)
  const blocked = decideCopyrightBlocked({
    confirmedIdentity: input.confirmedIdentity,
    action: input.action,
    usage: input.usage,
    acceptAuthorizationTerms: input.acceptAuthorizationTerms,
  })
  if (blocked) throw new ModelError(blocked)

  const usage = input.action === 'approved' ? input.usage! : (input.usage ?? 'none')
  const portfolioDisplay = input.action === 'approved'
  const commercialSublicensing = input.action === 'approved' && usage === 'commercial'
  const quality: CopyrightStatus = input.action === 'approved'
    ? 'verified'
    : input.action === 'unauthorized'
      ? 'disputed'
      : row.quality
  const nextCopyright: CopyrightStatus = input.action === 'unauthorized'
    ? 'disputed'
    : input.action === 'approved'
      ? 'verified'
      : input.action === 'rejected' || input.action === 'not_me'
        ? 'restricted'
        : row.photo.rightsRecord?.copyrightStatus ?? 'claimed'

  const photographerUser = row.inviteEmail
    ? await prisma.user.findUnique({
        where: { email: row.inviteEmail.toLowerCase() },
        include: { contributorProfile: true, platformAgreements: true },
      })
    : null
  const photographerAccount =
    photographerUser
    && (
      photographerUser.accountType === 'photographer'
      || photographerUser.accountType === 'admin'
      || (
        photographerUser.accountType === 'model'
        && photographerUser.platformAgreements.some((a) => a.version === CURRENT_AGREEMENT_VERSION && a.status === 'accepted')
      )
    )
      ? photographerUser
      : null

  const updated = await prisma.copyrightAuthorization.update({
    where: { id: input.authorizationId },
    data: {
      status: appearanceStatusForDecision(input.action),
      decisionKind: input.action,
      usage,
      portfolioDisplay,
      commercialSublicensing,
      aiTraining: false,
      quality,
      notes: input.notes ?? row.notes,
      decidedAt: new Date(),
      consentVersion: input.action === 'approved' ? COPYRIGHT_AUTHORIZATION_TERMS_VERSION : null,
      photographerUserId: photographerAccount?.id ?? row.photographerUserId,
    },
    include: copyrightInclude,
  })

  await prisma.rightsRecord.update({
    where: { photoId: row.photoId },
    data: {
      copyrightStatus: nextCopyright,
      copyrightMethod: input.action === 'approved' ? 'vuekumi_direct' : row.photo.rightsRecord?.copyrightMethod,
      copyrightVerified: nextCopyright === 'verified' || nextCopyright === 'documented' || nextCopyright === 'claimed',
      copyrightHolder: input.action === 'approved' ? row.displayName : row.photo.rightsRecord?.copyrightHolder,
    },
  })

  if (input.action === 'approved' && photographerAccount && row.photo.contributorId !== photographerAccount.id) {
    await prisma.photo.update({
      where: { id: row.photoId },
      data: { contributorId: photographerAccount.id },
    })
  }

  if (input.action === 'unauthorized') {
    await prisma.photo.update({
      where: { id: row.photoId },
      data: { commercialLocked: true, commercialLockedAt: new Date() },
    })
    await holdAvailableEarnings({ photoIds: [row.photoId], reason: 'copyright_dispute' })
  }

  await syncVerifiedRightsRecord(row.photoId)
  await appendRightsLedgerEvent({
    photoId: row.photoId,
    action: `copyright.${input.action}`,
    actorId: input.actorId,
    actorKind: input.actorId ? 'user' : 'guest',
    agreementVersion: input.action === 'approved' ? COPYRIGHT_AUTHORIZATION_TERMS_VERSION : null,
    nextCopyright,
    nextQuality: quality,
    relatedIds: { authorizationId: updated.id },
    scopes: {
      portfolio_display: portfolioDisplay,
      commercial_sublicensing: commercialSublicensing,
      ai_training: false,
    },
  })
  return updated
}

export function relatedCopyrightWhere(invite: {
  inviteEmail: string | null
  photo: { uploadedById: string | null }
}) {
  if (!invite.inviteEmail) return null
  return {
    inviteEmail: invite.inviteEmail,
    photo: invite.photo.uploadedById
      ? { uploadedById: invite.photo.uploadedById }
      : undefined,
  }
}

export async function userHasPhotographerAgreement(userId: string): Promise<boolean> {
  const count = await prisma.platformAgreement.count({
    where: { userId, version: CURRENT_AGREEMENT_VERSION, status: 'accepted' },
  })
  return count > 0
}

export async function issueCopyrightInvite(authorizationId: string) {
  const raw = createToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + MODEL_INVITE_DAYS * 24 * 60 * 60 * 1000)
  const updated = await prisma.copyrightAuthorization.update({
    where: { id: authorizationId },
    data: {
      status: 'invited',
      inviteTokenHash: hashToken(raw),
      inviteExpiresAt: expiresAt,
      invitedAt: now,
    },
    include: copyrightInclude,
  })
  const joinUrl = `${config.webUrl}/invite/photographer/${raw}`
  if (updated.inviteEmail) {
    await sendEmail({
      to: updated.inviteEmail,
      subject: 'VueKumi rights clearance — a model identified you as the photographer',
      html: photographerRightsNoticeEmail({
        displayName: updated.displayName,
        modelName: updated.photo.uploadedBy?.name ?? updated.photo.contributor.name,
        photoTitle: updated.photo.title,
        link: joinUrl,
      }),
    })
  }
  return { authorization: updated, joinUrl, raw }
}
