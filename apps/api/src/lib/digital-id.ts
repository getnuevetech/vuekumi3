import { createHash, randomBytes } from 'node:crypto'
import {
  DIGITAL_ID_CARD_LABEL,
  digitalIdProfilePath,
  type DigitalIdCardType,
  type DigitalIdPreviewDto,
  type DigitalIdPublicDto,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'

function publicIdFromToken(token: string) {
  return createHash('sha256').update(token).digest('hex').slice(0, 10).toUpperCase()
}

function mintToken(cardType: DigitalIdCardType, handle: string) {
  const slug = handle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
  return `vkid-${cardType.slice(0, 3)}-${slug}-${randomBytes(4).toString('hex')}`
}

function toPreview(card: {
  publicToken: string
  cardType: string
  status: string
}, cardType: DigitalIdCardType): DigitalIdPreviewDto {
  return {
    token: card.publicToken,
    cardType: card.cardType as DigitalIdCardType,
    status: card.status === 'revoked' ? 'revoked' : 'active',
    roleLabel: DIGITAL_ID_CARD_LABEL[cardType],
  }
}

async function findOwnedCard(profileId: string, cardType: DigitalIdCardType) {
  return prisma.digitalIdentityCard.findFirst({
    where: { profileId, cardType },
    orderBy: { issuedAt: 'desc' },
  })
}

export async function ensureDigitalIdCard(input: {
  profileId: string
  cardType: DigitalIdCardType
  handle: string
  /** Stable seed tokens for local/CI demos — only used when no card exists yet. */
  preferredToken?: string
}): Promise<DigitalIdPreviewDto> {
  const existing = await findOwnedCard(input.profileId, input.cardType)
  if (existing) return toPreview(existing, input.cardType)

  const candidates = [
    input.preferredToken,
    mintToken(input.cardType, input.handle),
    mintToken(input.cardType, input.handle),
  ].filter((token): token is string => Boolean(token))

  let lastError: unknown
  for (const token of candidates) {
    try {
      const created = await prisma.digitalIdentityCard.create({
        data: {
          profileId: input.profileId,
          cardType: input.cardType,
          publicToken: token,
          status: 'active',
        },
      })
      return toPreview(created, input.cardType)
    } catch (err) {
      lastError = err
      // Concurrent ensure won, or preferred/minted token is already taken
      // (including orphaned rows after a re-seed). Only reclaim a card we own —
      // never return another profile's publicToken.
      const owned = await findOwnedCard(input.profileId, input.cardType)
      if (owned) return toPreview(owned, input.cardType)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to issue Digital ID card')
}

export function contributorCardType(accountType: string, creatorKind: string): DigitalIdCardType {
  if (accountType === 'contributor') return 'contributor'
  if (creatorKind === 'photo_influencer' || accountType === 'photo_influencer') return 'photo_influencer'
  return 'photographer'
}

export async function getDigitalIdPublic(token: string): Promise<DigitalIdPublicDto | null> {
  const card = await prisma.digitalIdentityCard.findUnique({ where: { publicToken: token } })
  if (!card) return null
  const cardType = card.cardType as DigitalIdCardType

  if (cardType === 'model') {
    const profile = await prisma.modelProfile.findUnique({
      where: { id: card.profileId },
      include: { user: { select: { name: true, avatarUrl: true, status: true } } },
    })
    if (!profile || profile.user.status !== 'active') return null
    return {
      token: card.publicToken,
      cardType,
      status: card.status === 'revoked' ? 'revoked' : 'active',
      issuedAt: card.issuedAt.toISOString(),
      displayName: profile.user.name,
      handle: profile.handle,
      roleLabel: DIGITAL_ID_CARD_LABEL.model,
      location: profile.location,
      publicId: publicIdFromToken(card.publicToken),
      profilePath: digitalIdProfilePath('model', profile.handle),
      avatarUrl: profile.user.avatarUrl,
      badge: 'Model',
    }
  }

  const profile = await prisma.contributorProfile.findUnique({
    where: { id: card.profileId },
    include: { user: { select: { name: true, avatarUrl: true, status: true, accountType: true } } },
  })
  if (!profile || profile.user.status !== 'active') return null
  const resolvedType = contributorCardType(profile.user.accountType, profile.creatorKind)
  return {
    token: card.publicToken,
    cardType: resolvedType,
    status: card.status === 'revoked' ? 'revoked' : 'active',
    issuedAt: card.issuedAt.toISOString(),
    displayName: profile.user.name,
    handle: profile.handle,
    roleLabel: DIGITAL_ID_CARD_LABEL[resolvedType],
    location: profile.location,
    publicId: publicIdFromToken(card.publicToken),
    profilePath: digitalIdProfilePath(resolvedType, profile.handle),
    avatarUrl: profile.user.avatarUrl,
    badge: resolvedType === 'photo_influencer' ? 'Open Creator' : DIGITAL_ID_CARD_LABEL[resolvedType],
  }
}

export async function listDigitalIdsForProfiles(input: {
  contributorProfileId?: string | null
  modelProfileId?: string | null
}): Promise<import('@vuekumi/shared').AdminDigitalIdCardDto[]> {
  const profileIds = [input.contributorProfileId, input.modelProfileId].filter(
    (id): id is string => Boolean(id),
  )
  if (!profileIds.length) return []
  const cards = await prisma.digitalIdentityCard.findMany({
    where: { profileId: { in: profileIds } },
    orderBy: [{ issuedAt: 'desc' }],
  })
  return cards.map((card) => {
    const cardType = card.cardType as DigitalIdCardType
    const profileKind = card.profileId === input.modelProfileId ? 'model' : 'contributor'
    return {
      id: card.id,
      token: card.publicToken,
      cardType,
      status: card.status === 'revoked' ? 'revoked' as const : 'active' as const,
      roleLabel: DIGITAL_ID_CARD_LABEL[cardType],
      issuedAt: card.issuedAt.toISOString(),
      revokedAt: card.revokedAt?.toISOString() ?? null,
      profileKind,
    }
  })
}

export async function setDigitalIdStatus(input: {
  cardId: string
  status: 'active' | 'revoked'
}) {
  const card = await prisma.digitalIdentityCard.findUnique({ where: { id: input.cardId } })
  if (!card) return null
  return prisma.digitalIdentityCard.update({
    where: { id: input.cardId },
    data: {
      status: input.status,
      revokedAt: input.status === 'revoked' ? new Date() : null,
    },
  })
}
