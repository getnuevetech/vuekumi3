import type { CopyrightStatus, CreationClaim, ModelConsentStatus, Prisma } from '@prisma/client'
import {
  appearanceLikenessQuality,
  isCommerciallyEligible,
  publicRightsVerified,
  thirdPartyCopyright,
  type CopyrightMethod,
  type LikenessQuality,
  type RightsLedgerActorKind,
  type RightsLedgerDto,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'

type Tx = Prisma.TransactionClient | typeof prisma

export async function appendRightsLedgerEvent(
  input: {
    photoId: string
    action: string
    actorId?: string | null
    actorKind?: RightsLedgerActorKind
    agreementVersion?: string | null
    channel?: string | null
    scopes?: Record<string, unknown> | null
    relatedIds?: Record<string, unknown> | null
    previousCopyright?: CopyrightStatus | null
    nextCopyright?: CopyrightStatus | null
    previousLikeness?: ModelConsentStatus | null
    nextLikeness?: ModelConsentStatus | null
    previousQuality?: string | null
    nextQuality?: string | null
    commercialEligible?: boolean
    ip?: string | null
    userAgent?: string | null
  },
  client: Tx = prisma,
) {
  return client.rightsLedgerEvent.create({
    data: {
      photoId: input.photoId,
      action: input.action,
      actorId: input.actorId ?? undefined,
      actorKind: input.actorKind ?? (input.actorId ? 'user' : 'system'),
      agreementVersion: input.agreementVersion ?? undefined,
      channel: input.channel ?? undefined,
      scopesJson: input.scopes ? (input.scopes as Prisma.InputJsonValue) : undefined,
      relatedIdsJson: input.relatedIds ? (input.relatedIds as Prisma.InputJsonValue) : undefined,
      previousCopyright: input.previousCopyright ?? undefined,
      nextCopyright: input.nextCopyright ?? undefined,
      previousLikeness: input.previousLikeness ?? undefined,
      nextLikeness: input.nextLikeness ?? undefined,
      previousQuality: input.previousQuality ?? undefined,
      nextQuality: input.nextQuality ?? undefined,
      commercialEligible: input.commercialEligible ?? false,
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  })
}

export async function loadRightsLedger(photoId: string): Promise<RightsLedgerDto | null> {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: {
      uploadedBy: { select: { id: true, name: true, accountType: true } },
      contributor: { select: { id: true, name: true, accountType: true } },
      rightsRecord: true,
      appearances: true,
      ledgerEvents: {
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  })
  if (!photo) return null
  const claim = photo.creationClaim as CreationClaim
  const copyrightStatus = photo.rightsRecord?.copyrightStatus ?? 'claimed'
  const modelConsentStatus = photo.rightsRecord?.modelConsentStatus ?? 'not_required'
  const commercialEligible = isCommerciallyEligible({
    copyrightStatus,
    modelConsentStatus,
    commercialLocked: photo.commercialLocked,
    creationClaim: claim,
    appearances: photo.appearances,
  })
  const qualities = photo.appearances.map((row) => appearanceLikenessQuality(row))
  const likenessQuality: LikenessQuality | null = photo.hasRecognizablePeople
    ? qualities.includes('claimed')
      ? 'claimed'
      : qualities.includes('documented')
        ? 'documented'
        : qualities.includes('verified')
          ? 'verified'
          : 'claimed'
    : null
  const uploader = photo.uploadedBy ?? photo.contributor
  return {
    photoId: photo.id,
    title: photo.title,
    uploadedBy: uploader
      ? { id: uploader.id, name: uploader.name, accountType: uploader.accountType }
      : null,
    creationClaim: claim,
    thirdPartyCopyright: thirdPartyCopyright(claim),
    copyright: {
      status: copyrightStatus,
      method: (photo.rightsRecord?.copyrightMethod ?? 'attestation') as CopyrightMethod,
      holder: photo.rightsRecord?.copyrightHolder ?? null,
      attestedAt: photo.rightsRecord?.copyrightAttestedAt?.toISOString() ?? null,
    },
    likeness: {
      status: modelConsentStatus,
      quality: likenessQuality,
    },
    commercialEligible,
    commercialLocked: photo.commercialLocked,
    rightsVerified: publicRightsVerified({
      copyrightStatus,
      modelConsentStatus,
      appearances: photo.appearances,
    }),
    events: photo.ledgerEvents.map((event) => ({
      id: event.id,
      photoId: event.photoId,
      actorKind: event.actorKind,
      actorId: event.actorId,
      actorName: event.actor?.name ?? null,
      action: event.action,
      agreementVersion: event.agreementVersion,
      channel: event.channel,
      previousCopyright: event.previousCopyright,
      nextCopyright: event.nextCopyright,
      previousLikeness: event.previousLikeness,
      nextLikeness: event.nextLikeness,
      previousQuality: event.previousQuality,
      nextQuality: event.nextQuality,
      commercialEligible: event.commercialEligible,
      createdAt: event.createdAt.toISOString(),
    })),
  }
}
