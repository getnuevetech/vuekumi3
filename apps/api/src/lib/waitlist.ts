import type { Prisma } from '@prisma/client'
import type { ContributorWaitlistDto } from '@vuekumi/shared'
import { agreementVersionForAccountType } from '../data/licenses.js'
import { prisma } from './prisma.js'
import { resolveContributorSignup } from './policy-decision.js'

export class WaitlistError extends Error {
  statusCode: number
  reasonCodes?: string[]
  constructor(message: string, statusCode = 400, reasonCodes?: string[]) {
    super(message)
    this.statusCode = statusCode
    this.reasonCodes = reasonCodes
  }
}

export function serializeWaitlist(row: {
  id: string
  email: string
  userId: string | null
  countryCode: string
  accountType: string
  name: string
  status: string
  reasonCodes: string[]
  policyVersion: string | null
  notes: string | null
  promotedAt: Date | null
  createdAt: Date
}): ContributorWaitlistDto {
  return {
    id: row.id,
    email: row.email,
    userId: row.userId,
    countryCode: row.countryCode,
    accountType: row.accountType,
    name: row.name,
    status: row.status as ContributorWaitlistDto['status'],
    reasonCodes: row.reasonCodes,
    policyVersion: row.policyVersion,
    notes: row.notes,
    promotedAt: row.promotedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function enrollContributorWaitlist(input: {
  email: string
  userId?: string | null
  countryCode: string
  accountType: string
  name: string
  reasonCodes: string[]
  policyVersion?: string | null
  notes?: string | null
}, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const countryCode = input.countryCode.toUpperCase()
  const email = input.email.toLowerCase()
  const row = await client.contributorWaitlist.upsert({
    where: {
      email_countryCode_accountType: {
        email,
        countryCode,
        accountType: input.accountType,
      },
    },
    create: {
      email,
      userId: input.userId ?? null,
      countryCode,
      accountType: input.accountType,
      name: input.name,
      status: 'waiting',
      reasonCodes: input.reasonCodes,
      policyVersion: input.policyVersion ?? null,
      notes: input.notes ?? null,
    },
    update: {
      userId: input.userId ?? undefined,
      name: input.name,
      status: 'waiting',
      reasonCodes: input.reasonCodes,
      policyVersion: input.policyVersion ?? null,
      notes: input.notes ?? null,
      promotedAt: null,
      promotedById: null,
    },
  })
  return serializeWaitlist(row)
}

export async function listContributorWaitlist(filter: {
  countryCode?: string
  status?: string
} = {}) {
  const rows = await prisma.contributorWaitlist.findMany({
    where: {
      ...(filter.countryCode ? { countryCode: filter.countryCode.toUpperCase() } : {}),
      ...(filter.status ? { status: filter.status } : { status: 'waiting' }),
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  })
  return rows.map(serializeWaitlist)
}

/**
 * Promote a waitlisted user to a full contributor once the market allows signup.
 * Creates ContributorProfile if missing; does not invent agreements already on file.
 */
export async function promoteWaitlistEntry(input: {
  waitlistId: string
  actorId: string
}) {
  const entry = await prisma.contributorWaitlist.findUnique({ where: { id: input.waitlistId } })
  if (!entry) throw new WaitlistError('Waitlist entry not found', 404)
  if (entry.status === 'promoted') throw new WaitlistError('Already promoted')
  if (!entry.userId) throw new WaitlistError('Waitlist entry has no linked user account')

  const signup = await resolveContributorSignup(entry.countryCode)
  if (signup.outcome !== 'allow') {
    throw new WaitlistError(
      signup.outcome === 'waitlist'
        ? 'Country is still on HOLD — cannot promote until ACTIVE'
        : signup.message,
      400,
      signup.reasonCodes,
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: entry.userId },
    include: { contributorProfile: true },
  })
  if (!user) throw new WaitlistError('Linked user not found', 404)

  await prisma.$transaction(async (tx) => {
    if (!user.contributorProfile) {
      const handleBase = user.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'creator'
      await tx.contributorProfile.create({
        data: {
          userId: user.id,
          handle: `${handleBase}-${user.id.slice(-4)}`,
          location: entry.countryCode,
          creatorKind:
            entry.accountType === 'photo_influencer'
              ? 'photo_influencer'
              : entry.accountType === 'contributor'
                ? 'photographer'
                : 'photographer',
        },
      })
    }
    const hasAgreement = await tx.platformAgreement.findFirst({ where: { userId: user.id } })
    if (!hasAgreement) {
      await tx.platformAgreement.create({
        data: { userId: user.id, version: agreementVersionForAccountType(entry.accountType) },
      })
    }
    await tx.user.update({
      where: { id: user.id },
      data: { status: 'active', country: entry.countryCode },
    })
    await tx.contributorWaitlist.update({
      where: { id: entry.id },
      data: {
        status: 'promoted',
        promotedAt: new Date(),
        promotedById: input.actorId,
      },
    })
  })

  const updated = await prisma.contributorWaitlist.findUniqueOrThrow({ where: { id: entry.id } })
  return serializeWaitlist(updated)
}
