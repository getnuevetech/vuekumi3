import type { ProfileCollaboratorDto } from '@vuekumi/shared'
import { PROFILE_PHOTO_FILTER } from './catalog.js'
import { prisma } from './prisma.js'

const COLLABORATOR_LIMIT = 12

/** Distinct copyright owners on a model's approved, profile-visible appearances. */
export async function modelCollaboratingPhotographers(
  modelUserId: string,
  limit = COLLABORATOR_LIMIT,
): Promise<ProfileCollaboratorDto[]> {
  const rows = await prisma.photoAppearance.findMany({
    where: {
      modelUserId,
      status: 'approved',
      confirmedLikeness: true,
      photo: PROFILE_PHOTO_FILTER,
    },
    orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      photo: {
        select: {
          contributor: {
            select: {
              name: true,
              avatarUrl: true,
              contributorProfile: { select: { handle: true, location: true } },
            },
          },
        },
      },
    },
    take: 200,
  })

  const seen = new Map<string, ProfileCollaboratorDto>()
  for (const row of rows) {
    const profile = row.photo.contributor.contributorProfile
    if (!profile?.handle || seen.has(profile.handle)) continue
    seen.set(profile.handle, {
      handle: profile.handle,
      name: row.photo.contributor.name,
      avatarUrl: row.photo.contributor.avatarUrl,
      kind: 'photographer',
      location: profile.location,
    })
    if (seen.size >= limit) break
  }
  return [...seen.values()]
}

/** Distinct models with approved likeness on a contributor's profile-visible photos. */
export async function photographerCollaboratingModels(
  contributorUserId: string,
  limit = COLLABORATOR_LIMIT,
): Promise<ProfileCollaboratorDto[]> {
  const rows = await prisma.photoAppearance.findMany({
    where: {
      status: 'approved',
      confirmedLikeness: true,
      modelUser: { status: 'active', modelProfile: { isNot: null } },
      photo: {
        contributorId: contributorUserId,
        ...PROFILE_PHOTO_FILTER,
      },
    },
    orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      modelUser: {
        select: {
          name: true,
          avatarUrl: true,
          modelProfile: { select: { handle: true, location: true } },
        },
      },
    },
    take: 200,
  })

  const seen = new Map<string, ProfileCollaboratorDto>()
  for (const row of rows) {
    const profile = row.modelUser.modelProfile
    if (!profile?.handle || seen.has(profile.handle)) continue
    seen.set(profile.handle, {
      handle: profile.handle,
      name: row.modelUser.name,
      avatarUrl: row.modelUser.avatarUrl,
      kind: 'model',
      location: profile.location,
    })
    if (seen.size >= limit) break
  }
  return [...seen.values()]
}
