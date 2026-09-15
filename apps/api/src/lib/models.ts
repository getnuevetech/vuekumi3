import type {
  AccountType,
  ModelAppearanceStatus,
  ModelUsagePreference,
  PermissionState,
  PhotoAppearanceDto,
} from '@vuekumi/shared'
import { twoPartyCommercialCleared } from '@vuekumi/shared'
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
  if (accountType === 'contributor') {
    return 'Photographers cannot become models on the same email. One account type per email.'
  }
  if (accountType === 'admin') return 'Administrators cannot become models'
  if (accountType === 'agency') return 'Agency accounts cannot become models'
  return null
}

export function decideAppearanceBlocked(input: {
  confirmedLikeness: boolean
  status: 'approved' | 'rejected'
  usage?: ModelUsagePreference | null
}): string | null {
  if (input.status === 'approved' && !input.confirmedLikeness) {
    return 'Approving usage requires confirming this is your likeness'
  }
  if (input.status === 'approved' && (!input.usage || input.usage === 'none')) {
    return 'Choose editorial or commercial usage when you approve'
  }
  return null
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
  for (let i = 0; i < 6; i++) {
    const suffix = userId.slice(-(4 + i))
    const handle = slugModelHandle(name, suffix)
    if (!(await handleTaken(handle))) return handle
  }
  return slugModelHandle(name, userId.replace(/[^a-z0-9]/gi, '').slice(-8) || 'model')
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
  },
  opts?: { includeEmail?: boolean },
): PhotoAppearanceDto {
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
    photographerName: photo?.contributor?.name,
    displayName: row.displayName,
    inviteEmail: opts?.includeEmail ? row.inviteEmail : undefined,
    status: row.status,
    usage: row.usage,
    confirmedLikeness: row.confirmedLikeness,
    modelHandle: row.modelUser?.modelProfile?.handle ?? null,
    invitedAt: row.invitedAt ? row.invitedAt.toISOString() : null,
    claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    inviteExpiresAt: row.inviteExpiresAt ? row.inviteExpiresAt.toISOString() : null,
    consentVersion: row.consentVersion,
    notes: row.notes,
  }
}

export function publicAppearances(
  rows: Parameters<typeof serializeAppearance>[0][],
): PhotoAppearanceDto[] {
  return rows
    .filter((row) => row.status === 'approved')
    .map((row) => serializeAppearance(row, { includeEmail: false }))
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
  if (next === photo.permissionState) return
  await prisma.photo.update({
    where: { id: photoId },
    data: permissionWriteData(next, photo.exclusiveSold),
  })
  if (photo.rightsRecord?.processVerifiedAt) {
    await prisma.rightsRecord.update({
      where: { photoId },
      data: { processVerifiedAt: null, processVerifiedById: null, consentVersion: null },
    })
  }
}
