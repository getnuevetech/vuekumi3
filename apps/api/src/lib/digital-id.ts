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

export async function ensureDigitalIdCard(input: {
  profileId: string
  cardType: DigitalIdCardType
  handle: string
  /** Stable seed tokens for local/CI demos — only used when no card exists yet. */
  preferredToken?: string
}): Promise<DigitalIdPreviewDto> {
  const existing = await prisma.digitalIdentityCard.findFirst({
    where: { profileId: input.profileId, cardType: input.cardType },
    orderBy: { issuedAt: 'desc' },
  })
  if (existing) {
    return {
      token: existing.publicToken,
      cardType: existing.cardType as DigitalIdCardType,
      status: existing.status === 'revoked' ? 'revoked' : 'active',
      roleLabel: DIGITAL_ID_CARD_LABEL[input.cardType],
    }
  }

  const token = input.preferredToken ?? mintToken(input.cardType, input.handle)
  const created = await prisma.digitalIdentityCard.create({
    data: {
      profileId: input.profileId,
      cardType: input.cardType,
      publicToken: token,
      status: 'active',
    },
  }).catch(async (err) => {
    // Concurrent ensure or dual-role preferred-token races: re-read.
    const again = await prisma.digitalIdentityCard.findFirst({
      where: {
        OR: [
          { profileId: input.profileId, cardType: input.cardType },
          { publicToken: token },
        ],
      },
      orderBy: { issuedAt: 'desc' },
    })
    if (again) return again
    throw err
  })
  return {
    token: created.publicToken,
    cardType: input.cardType,
    status: created.status === 'revoked' ? 'revoked' : 'active',
    roleLabel: DIGITAL_ID_CARD_LABEL[input.cardType],
  }
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
