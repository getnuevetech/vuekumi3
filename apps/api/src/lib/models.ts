import type {
  AccountType,
  AppearanceDecisionKind,
  LikenessCheckDto,
  ModelAppearanceStatus,
  ModelConsentStatus,
  ModelUsagePreference,
  PermissionState,
  PhotoAppearanceDto,
  ReleaseVerificationLevel,
  SubjectAgeClass,
} from '@vuekumi/shared'
import {
  isCommerciallyEligible,
  rollupModelConsentStatus,
  twoPartyCommercialCleared,
} from '@vuekumi/shared'
import type { PhotoAppearance, User } from '@prisma/client'
import { prisma } from './prisma.js'
import { permissionAfterTwoParty, permissionWriteData } from './permissions.js'

export class ModelError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ModelError'
    this.statusCode = statusCode
  }
}

export const MODEL_INVITE_DAYS = 14

export function modelAccountBlocked(accountType: AccountType | undefined): string | null {
  if (!accountType) return null
  if (accountType === 'admin') return 'Administrators cannot become models'
  if (accountType === 'agency') return 'Agency accounts cannot become models'
  return null
}

export function ownEmailInviteBlocked(
  inviteEmail: string,
  ownerEmail: string | undefined | null,
): string | null {
  if (!ownerEmail) return null
  if (inviteEmail.trim().toLowerCase() === ownerEmail.trim().toLowerCase()) {
    return 'Identify yourself on this photograph instead of sending an invite'
  }
  return null
}

export const appearanceInclude = {
  photo: { include: { contributor: true, assets: true, shoot: true } },
  modelUser: { include: { modelProfile: true } },
  likenessChecks: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} as const

export function relatedAppearanceWhere(invite: {
  inviteEmail: string | null
  photo: { contributorId: string; shootId: string | null }
}) {
  if (!invite.inviteEmail) return null
  return {
    inviteEmail: invite.inviteEmail,
    photo: invite.photo.shootId
      ? { contributorId: invite.photo.contributorId, shootId: invite.photo.shootId }
      : { contributorId: invite.photo.contributorId },
  }
}

export function decideAppearanceBlocked(input: {
  confirmedLikeness: boolean
  status: 'approved' | 'rejected' | 'not_me' | 'unauthorized'
  usage?: ModelUsagePreference | null
  acceptReleaseTerms?: boolean
}): string | null {
  if (input.status === 'approved' && !input.confirmedLikeness) {
    return 'Approving usage requires confirming this is your likeness'
  }
  if (input.status === 'approved' && (!input.usage || input.usage === 'none')) {
    return 'Choose editorial or commercial usage when you approve'
  }
  if ((input.status === 'not_me' || input.status === 'unauthorized') && input.confirmedLikeness) {
    return 'Do not confirm likeness if this is not you or the submission is unauthorized'
  }
  return null
}

export function appearanceStatusForDecision(kind: AppearanceDecisionKind): ModelAppearanceStatus {
  if (kind === 'approved') return 'approved'
  return 'rejected'
}

export function consentStatusForDecision(kind: AppearanceDecisionKind): ModelConsentStatus {
  if (kind === 'approved') return 'approved'
  if (kind === 'not_me' || kind === 'unauthorized') return 'disputed'
  return 'rejected'
}

export function appearanceUnclaimed(status: ModelAppearanceStatus): boolean {
  return status === 'identified' || status === 'invited'
}

export function slugModelHandle(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'model'
  const handle = `${base}-${suffix}`.replace(/-+/g, '-').slice(0, 40)
  return handle.length < 3 ? `mdl-${suffix}`.slice(0, 40) : handle
}

export async function handleTaken(handle: string, excludeUserId?: string): Promise<boolean> {
  const whereUser = excludeUserId ? { userId: { not: excludeUserId } } : {}
  const [contributor, model] = await Promise.all([
    prisma.contributorProfile.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' }, ...whereUser },
    }),
    prisma.modelProfile.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' }, ...whereUser },
    }),
  ])
  return Boolean(contributor || model)
}

export async function uniqueModelHandle(name: string, userId: string): Promise<string> {
  const contributor = await prisma.contributorProfile.findUnique({ where: { userId } })
  if (contributor && !(await handleTaken(contributor.handle, userId))) {
    return contributor.handle
  }
  for (let i = 0; i < 6; i++) {
    const suffix = userId.slice(-(4 + i))
    const handle = slugModelHandle(name, suffix)
    if (!(await handleTaken(handle, userId))) return handle
  }
  return slugModelHandle(name, userId.replace(/[^a-z0-9]/gi, '').slice(-8) || 'model')
}

export async function ensureModelProfile(userId: string, name: string) {
  const existing = await prisma.modelProfile.findUnique({ where: { userId } })
  if (existing) return existing
  const contributor = await prisma.contributorProfile.findUnique({ where: { userId } })
  const handle = await uniqueModelHandle(name, userId)
  return prisma.modelProfile.create({
    data: {
      userId,
      handle,
      location: contributor?.location ?? null,
      bio: contributor?.bio ?? null,
    },
  })
}

export async function claimPendingForEmail(userId: string, email: string) {
  const now = new Date()
  const normalized = email.toLowerCase()
  const pending = await prisma.photoAppearance.findMany({
    where: {
      inviteEmail: normalized,
      modelUserId: null,
      status: { in: ['identified', 'invited'] },
    },
  })
  if (pending.length === 0) return
  await prisma.photoAppearance.updateMany({
    where: { id: { in: pending.map((row) => row.id) } },
    data: {
      modelUserId: userId,
      status: 'claimed',
      consentStatus: 'pending',
      claimedAt: now,
      inviteTokenHash: null,
    },
  })
}

export function serializeAppearance(
  row: PhotoAppearance & {
    photo?: {
      id: string
      title: string
      src: string
      storageKey?: string | null
      processingStatus?: string | null
      contributor?: { name: string } | null
    } | null
    modelUser?: (Pick<User, 'id'> & { modelProfile?: { handle: string } | null }) | null
    likenessChecks?: {
      status: string
      consentedAt: Date
      comparedAt: Date
      provider: string
      referenceDeletedAt: Date | null
      notes: string | null
    }[]
  },
  opts?: { includeEmail?: boolean; includeMobile?: boolean; includeVerification?: boolean; includeGuardian?: boolean },
): PhotoAppearanceDto {
  const photo = row.photo
  const src =
    photo?.storageKey && photo.processingStatus === 'ready'
      ? `/api/media/${photo.id}/preview`
      : photo?.src
  const latest = row.likenessChecks?.[0]
  const verification: LikenessCheckDto | null = latest
    ? {
        status: latest.status as LikenessCheckDto['status'],
        consentedAt: latest.consentedAt.toISOString(),
        comparedAt: latest.comparedAt.toISOString(),
        provider: latest.provider === 'openai' ? 'openai' : 'none',
        referenceDeleted: true,
        notes: latest.notes,
      }
    : null
  const consentStatus = (row as { consentStatus?: ModelConsentStatus }).consentStatus
    ?? (row.status === 'approved'
      ? 'approved'
      : row.status === 'rejected'
        ? 'rejected'
        : row.status === 'invited'
          ? 'invitation_sent'
          : row.status === 'claimed'
            ? 'pending'
            : 'required')
  return {
    id: row.id,
    photoId: row.photoId,
    photoTitle: photo?.title,
    photoSrc: src,
    photographerName: photo?.contributor?.name,
    displayName: row.displayName,
    inviteEmail: opts?.includeEmail ? row.inviteEmail : undefined,
    inviteMobile: opts?.includeMobile ? (row as { inviteMobile?: string | null }).inviteMobile ?? null : undefined,
    status: row.status,
    consentStatus,
    decisionKind: (row as { decisionKind?: AppearanceDecisionKind | null }).decisionKind ?? null,
    usage: row.usage,
    confirmedLikeness: row.confirmedLikeness,
    modelHandle: row.modelUser?.modelProfile?.handle ?? null,
    invitedAt: row.invitedAt ? row.invitedAt.toISOString() : null,
    claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    inviteExpiresAt: row.inviteExpiresAt ? row.inviteExpiresAt.toISOString() : null,
    consentVersion: row.consentVersion,
    selfShot: row.selfShot,
    notes: row.notes,
    verification: opts?.includeVerification ? verification : undefined,
    ageClass: ((row as { ageClass?: SubjectAgeClass }).ageClass ?? 'unknown') as SubjectAgeClass,
    isMinor: Boolean((row as { isMinor?: boolean }).isMinor),
    guardianAuthorized: Boolean((row as { guardianAuthorizedAt?: Date | null }).guardianAuthorizedAt),
    releaseVerificationLevel: ((row as { verificationLevel?: ReleaseVerificationLevel | null }).verificationLevel ?? null),
    modelReleaseVerified: consentStatus === 'approved' && row.confirmedLikeness,
  }
}

export function publicAppearances(
  rows: Parameters<typeof serializeAppearance>[0][],
): PhotoAppearanceDto[] {
  return rows
    .filter((row) => row.status === 'approved')
    .map((row) => serializeAppearance(row, { includeEmail: false }))
}

export async function applyAppearanceDecision(input: {
  appearanceId: string
  action: AppearanceDecisionKind
  confirmedLikeness: boolean
  usage?: ModelUsagePreference | null
  notes?: string | null
  actorId?: string | null
}) {
  const row = await prisma.photoAppearance.findUnique({ where: { id: input.appearanceId } })
  if (!row) throw new ModelError('Appearance not found', 404)
  const blocked = decideAppearanceBlocked({
    confirmedLikeness: input.confirmedLikeness,
    status: input.action,
    usage: input.usage,
  })
  if (blocked) throw new ModelError(blocked)
  const usage = input.action === 'approved' ? input.usage! : (input.usage ?? 'none')
  const updated = await prisma.photoAppearance.update({
    where: { id: input.appearanceId },
    data: {
      status: appearanceStatusForDecision(input.action),
      consentStatus: consentStatusForDecision(input.action),
      decisionKind: input.action,
      confirmedLikeness: input.action === 'approved' ? input.confirmedLikeness : false,
      usage,
      notes: input.notes ?? row.notes,
      decidedAt: new Date(),
      consentVersion: input.action === 'approved' ? '1.0' : null,
      verificationLevel: input.action === 'approved' ? 'vuekumi_verified' : row.verificationLevel,
    },
    include: appearanceInclude,
  })
  await syncPermissionToTwoParty(row.photoId)
  return updated
}

export async function syncVerifiedRightsRecord(photoId: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { appearances: true, rightsRecord: true },
  })
  if (!photo?.rightsRecord) return
  const modelConsentStatus = rollupModelConsentStatus({
    hasRecognizablePeople: photo.hasRecognizablePeople,
    appearances: photo.appearances,
  })
  const copyrightStatus = photo.rightsRecord.copyrightStatus
  const commercialEligible = isCommerciallyEligible({
    copyrightStatus,
    modelConsentStatus,
    commercialLocked: photo.commercialLocked,
  })
  await prisma.rightsRecord.update({
    where: { photoId },
    data: {
      modelConsentStatus,
      commercialEligible,
      modelReleaseRequired: photo.hasRecognizablePeople,
      copyrightVerified: copyrightStatus === 'claimed' || copyrightStatus === 'verified',
    },
  })
}

export async function syncPermissionToTwoParty(photoId: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { appearances: true, rightsRecord: true },
  })
  if (!photo) return
  const twoPartyCleared = twoPartyCommercialCleared({
    hasRecognizablePeople: photo.hasRecognizablePeople,
    appearances: photo.appearances,
  })
  const next = permissionAfterTwoParty({
    current: photo.permissionState as PermissionState,
    exclusiveSold: photo.exclusiveSold,
    twoPartyCleared,
    hasRecognizablePeople: photo.hasRecognizablePeople,
  })
  if (next !== photo.permissionState) {
    await prisma.photo.update({
      where: { id: photoId },
      data: permissionWriteData(next, photo.exclusiveSold),
    })
  }
  if (photo.rightsRecord?.processVerifiedAt && !twoPartyCleared) {
    await prisma.rightsRecord.update({
      where: { photoId },
      data: { processVerifiedAt: null, processVerifiedById: null, consentVersion: null },
    })
  }
  await syncVerifiedRightsRecord(photoId)
}
