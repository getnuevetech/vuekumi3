import type { FastifyReply, FastifyRequest } from 'fastify'
import { canImpersonateCreator, isCreatorWorkspaceAccount } from '@vuekumi/shared'
import { prisma } from './prisma.js'

export function isImpersonatingStaff(user: FastifyRequest['authUser']): boolean {
  return Boolean(user && user.accountType === 'admin' && canImpersonateCreator(user))
}

/**
 * Phase 43 — resolve which creator workspace the request operates on.
 * Creators always act as themselves. Staff with content.impersonate_creator must
 * pass ?userId= of an active photographer / photo_influencer / contributor.
 * Staff JWT stays; there is no cookie swap and no payout write-through.
 */
export async function resolveCreatorWorkspaceId(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string | null> {
  const user = request.authUser
  if (!user || !request.userId) {
    reply.code(401).send({ error: 'Unauthorized' })
    return null
  }

  if (isCreatorWorkspaceAccount(user.accountType)) {
    return request.userId
  }

  if (!isImpersonatingStaff(user)) {
    reply.code(403).send({ error: 'Forbidden' })
    return null
  }

  const raw = (request.query as { userId?: string }).userId
  const targetId = typeof raw === 'string' ? raw.trim() : ''
  if (!targetId) {
    reply.code(400).send({ error: 'userId is required when acting as a creator' })
    return null
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, accountType: true, status: true },
  })
  if (!target || target.status === 'suspended') {
    reply.code(404).send({ error: 'Creator not found' })
    return null
  }
  if (!isCreatorWorkspaceAccount(target.accountType)) {
    reply.code(400).send({
      error: 'Only photographer, photo influencer, or community contributor accounts can be opened',
    })
    return null
  }
  return target.id
}

export async function staffPayoutWriteBlocked(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (!isImpersonatingStaff(request.authUser)) return false
  reply.code(403).send({
    error: 'Staff cannot change payout methods or request payouts while acting as a creator',
  })
  return true
}
