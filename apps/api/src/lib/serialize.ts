import type { Photo, ContributorProfile, User, AdminProfile, AgencyMember } from '@prisma/client'
import type { AuthUser, PhotoDto } from '@vuekumi/shared'

type UserWithRelations = User & {
  contributorProfile?: ContributorProfile | null
  adminProfile?: AdminProfile | null
  agencyMembers?: AgencyMember[]
}

export function serializeUser(user: UserWithRelations): AuthUser {
  const agencyMember = user.agencyMembers?.[0]
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountType: user.accountType,
    status: user.status,
    country: user.country,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    contributorHandle: user.contributorProfile?.handle ?? null,
    adminRole: user.adminProfile?.adminRole ?? null,
    agencyId: agencyMember?.agencyId ?? null,
    agencyRole: agencyMember?.agencyRole ?? null,
  }
}

export function serializePhoto(
  photo: Photo & { tags: { tag: string }[] },
  photographerHandle: string,
): PhotoDto {
  return {
    id: photo.id,
    src: photo.src,
    title: photo.title,
    category: photo.category,
    country: photo.country,
    photographer: photographerHandle,
    license: photo.licenseType,
    price: photo.price,
    downloads: photo.downloads,
    views: photo.views,
    likes: photo.likes,
    tags: photo.tags.map((t) => t.tag),
    status: photo.status,
  }
}
