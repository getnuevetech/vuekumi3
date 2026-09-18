import type {
  AdminAccountDto,
  AdminCreateAccountInput,
  AdminCreateAdminInput,
  AdminRole,
  AgencyEntityStatus,
  CreatorKind,
} from '@vuekumi/shared'
import { resolveAdminCapabilities, storedAdminCapabilities } from '@vuekumi/shared'
import { registrationCreatorKind } from './creator-kind.js'
import { agreementVersionForAccountType } from '../data/licenses.js'
import { handleTaken } from './models.js'
import { hashPassword } from './password.js'
import { prisma } from './prisma.js'

type AccountRow = {
  id: string
  email: string
  name: string
  accountType: string
  status: string
  country: string | null
  createdAt: Date
  emailVerifiedAt: Date | null
  contributorProfile: {
    handle: string
    photosCount: number
    earnings: number
    downloads: number
    creatorKind: CreatorKind
  } | null
  modelProfile: { handle: string } | null
  userProfile: { subscriptionPlan: string; downloadQuotaUsed: number } | null
  adminProfile: {
    adminRole: AdminRole | string
    capabilities?: string[]
    capabilitiesCustomized?: boolean
  } | null
  ownedAgencies: { id: string; name: string; status: AgencyEntityStatus }[]
  agencyMembers?: { agency: { id: string; name: string; status: AgencyEntityStatus } }[]
  _count?: { modelAppearances: number }
}

export const adminAccountInclude = {
  contributorProfile: true,
  modelProfile: true,
  userProfile: true,
  adminProfile: true,
  ownedAgencies: true,
  agencyMembers: { include: { agency: { select: { id: true, name: true, status: true } } } },
  _count: { select: { modelAppearances: true } },
} as const

function agencyOf(user: AccountRow) {
  return user.ownedAgencies[0] ?? user.agencyMembers?.[0]?.agency ?? null
}

export function serializeAdminAccount(user: AccountRow): AdminAccountDto {
  const agency = agencyOf(user)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountType: user.accountType,
    status: user.status,
    country: user.country,
    joined: user.createdAt.toISOString().slice(0, 10),
    emailVerified: Boolean(user.emailVerifiedAt),
    handle: user.contributorProfile?.handle ?? user.modelProfile?.handle ?? null,
    creatorKind: user.contributorProfile?.creatorKind ?? null,
    photos: user.contributorProfile?.photosCount ?? 0,
    earnings: user.contributorProfile?.earnings ?? 0,
    downloads: user.contributorProfile?.downloads ?? user.userProfile?.downloadQuotaUsed ?? 0,
    plan: user.userProfile?.subscriptionPlan ?? null,
    adminRole: user.adminProfile?.adminRole ?? null,
    adminCapabilities: user.adminProfile
      ? resolveAdminCapabilities({
          adminRole: user.adminProfile.adminRole as AdminRole,
          capabilities: user.adminProfile.capabilities,
          capabilitiesCustomized: user.adminProfile.capabilitiesCustomized,
        })
      : undefined,
    adminCapabilitiesCustomized: user.adminProfile?.capabilitiesCustomized ?? false,
    agencyId: agency?.id ?? null,
    agencyName: agency?.name ?? null,
    agencyStatus: agency?.status ?? null,
    appearances: user._count?.modelAppearances ?? 0,
    dualRole: Boolean(user.contributorProfile && user.modelProfile),
  }
}

function slugBase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function uniqueStaffHandle(name: string, userId: string): Promise<string> {
  const base = slugBase(name) || 'creator'
  for (let i = 0; i < 8; i++) {
    const suffix = userId.slice(-(4 + i))
    const handle = `${base}-${suffix}`.replace(/-+/g, '-').slice(0, 40)
    if (handle.length >= 3 && !(await handleTaken(handle, userId))) return handle
  }
  return `u-${userId.replace(/[^a-z0-9]/gi, '').slice(-10)}`.slice(0, 40)
}

async function uniqueAgencySlug(name: string, userId: string): Promise<string> {
  const base = slugBase(name) || 'agency'
  for (let i = 0; i < 8; i++) {
    const suffix = userId.slice(-(4 + i))
    const slug = `${base}-${suffix}`.replace(/-+/g, '-').slice(0, 40)
    const taken = await prisma.agency.findUnique({ where: { slug } })
    if (!taken && slug.length >= 3) return slug
  }
  return `agency-${userId.replace(/[^a-z0-9]/gi, '').slice(-10)}`.slice(0, 40)
}

export async function provisionStaffCreatedUser(body: AdminCreateAccountInput) {
  const passwordHash = await hashPassword(body.password)
  const email = body.email.toLowerCase()
  const country = body.country?.toUpperCase()
  const accountType = body.accountType as Exclude<AdminCreateAccountInput['accountType'], 'admin'>

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: body.name.trim(),
        accountType,
        country,
        status: 'active',
      },
    })

    if (accountType === 'photographer' || accountType === 'photo_influencer' || accountType === 'contributor') {
      const handle = await uniqueStaffHandle(body.name, created.id)
      await tx.contributorProfile.create({
        data: {
          userId: created.id,
          handle,
          location: country ?? null,
          creatorKind: registrationCreatorKind(accountType) ?? 'photographer',
        },
      })
      await tx.platformAgreement.create({
        data: { userId: created.id, version: agreementVersionForAccountType(accountType) },
      })
    }

    if (accountType === 'user' || accountType === 'agency') {
      await tx.userProfile.create({ data: { userId: created.id } })
    }

    if (accountType === 'agency') {
      const slug = await uniqueAgencySlug(body.name, created.id)
      await tx.agency.create({
        data: {
          name: body.name.trim(),
          slug,
          ownerUserId: created.id,
          status: 'pending',
          billingEmail: email,
          members: { create: { userId: created.id, agencyRole: 'owner' } },
        },
      })
    }

    if (accountType === 'model') {
      const handle = await uniqueStaffHandle(body.name, created.id)
      await tx.modelProfile.create({
        data: {
          userId: created.id,
          handle,
          location: country ?? null,
        },
      })
    }

    return created.id
  })
}

export async function provisionStaffCreatedAdmin(body: AdminCreateAdminInput) {
  const passwordHash = await hashPassword(body.password)
  const stored = storedAdminCapabilities(body.preset, body.capabilities)
  const country = body.country?.toUpperCase()

  const created = await prisma.user.create({
    data: {
      email: body.email.toLowerCase(),
      passwordHash,
      name: body.name.trim(),
      accountType: 'admin',
      country,
      status: 'active',
      adminProfile: {
        create: {
          adminRole: body.preset,
          capabilities: stored.capabilities,
          capabilitiesCustomized: stored.capabilitiesCustomized,
        },
      },
    },
  })
  return created.id
}

export async function isLastActiveSuperAdmin(userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { adminProfile: true },
  })
  if (!target || target.accountType !== 'admin' || target.status !== 'active') return false
  if (target.adminProfile?.adminRole !== 'super_admin') return false
  const others = await prisma.user.count({
    where: {
      id: { not: userId },
      accountType: 'admin',
      status: 'active',
      adminProfile: { adminRole: 'super_admin' },
    },
  })
  return others === 0
}
