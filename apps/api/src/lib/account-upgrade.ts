import type { AccountUpgradeTarget } from '@vuekumi/shared'
import { accountUpgradeBlocked, creatorKindFromAccountType } from '@vuekumi/shared'
import { agreementVersionForAccountType } from '../data/licenses.js'
import { writeAuditLog } from './audit.js'
import { registrationCreatorKind } from './creator-kind.js'
import { ensureModelProfile } from './models.js'
import { prisma } from './prisma.js'
import { resolveContributorSignup } from './policy-decision.js'

export async function upgradeFromPhotoInfluencer(input: {
  userId: string
  targetAccountType: AccountUpgradeTarget
  ipAddress?: string
}): Promise<{ userId: string; accountType: AccountUpgradeTarget; waitlisted?: boolean; message?: string }> {
  const blocked = accountUpgradeBlocked('photo_influencer', input.targetAccountType)
  if (blocked) {
    const err = new Error(blocked) as Error & { statusCode?: number }
    err.statusCode = 400
    throw err
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { contributorProfile: true, modelProfile: true },
  })
  if (!user) {
    const err = new Error('Account not found') as Error & { statusCode?: number }
    err.statusCode = 404
    throw err
  }
  if (user.accountType !== 'photo_influencer') {
    const err = new Error(accountUpgradeBlocked(user.accountType, input.targetAccountType) ?? 'Upgrade not allowed') as Error & {
      statusCode?: number
    }
    err.statusCode = 400
    throw err
  }

  let waitlisted = false
  let waitlistMessage: string | undefined
  let status = user.status

  if (input.targetAccountType === 'photographer' || input.targetAccountType === 'contributor') {
    const signup = await resolveContributorSignup(user.country)
    if (signup.outcome === 'deny') {
      const err = new Error(signup.message) as Error & { statusCode?: number; reasonCodes?: string[] }
      err.statusCode = 400
      err.reasonCodes = signup.reasonCodes
      throw err
    }
    if (signup.outcome === 'waitlist') {
      waitlisted = true
      waitlistMessage = signup.message
      status = 'pending'
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        accountType: input.targetAccountType,
        status,
      },
    })

    if (input.targetAccountType === 'photographer' || input.targetAccountType === 'contributor') {
      const creatorKind = registrationCreatorKind(input.targetAccountType) ?? creatorKindFromAccountType(input.targetAccountType) ?? 'photographer'
      if (user.contributorProfile) {
        await tx.contributorProfile.update({
          where: { userId: user.id },
          data: { creatorKind },
        })
      } else {
        const handleBase = user.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'creator'
        await tx.contributorProfile.create({
          data: {
            userId: user.id,
            handle: `${handleBase}-${user.id.slice(-4)}`,
            location: user.country,
            creatorKind,
          },
        })
      }
    }

    await tx.platformAgreement.create({
      data: {
        userId: user.id,
        version: agreementVersionForAccountType(input.targetAccountType),
      },
    })
  })

  if (input.targetAccountType === 'model') {
    await ensureModelProfile(user.id, user.name)
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'account.upgrade',
    entityType: 'user',
    entityId: user.id,
    metadata: {
      from: 'photo_influencer',
      to: input.targetAccountType,
      waitlisted,
      freeLibraryAssetsUnchanged: true,
    },
    ipAddress: input.ipAddress,
  })

  return {
    userId: user.id,
    accountType: input.targetAccountType,
    waitlisted: waitlisted || undefined,
    message: waitlistMessage,
  }
}
