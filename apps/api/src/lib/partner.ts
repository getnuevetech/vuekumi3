import { createHash, randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { partnerAuthBlocked } from '@vuekumi/shared'
import { prisma } from './prisma.js'

/** Raw keys are shown once at creation; only the SHA-256 hash is stored. */
export function generatePartnerKey(): { key: string; hash: string; prefix: string } {
  const key = `vk_live_${randomBytes(24).toString('hex')}`
  return { key, hash: hashPartnerKey(key), prefix: key.slice(0, 15) }
}

export function hashPartnerKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function extractPartnerKey(headers: {
  authorization?: string
  'x-api-key'?: string
}): string | null {
  const bearer = headers.authorization
  if (bearer?.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim() || null
  const direct = headers['x-api-key']
  return direct?.trim() || null
}

declare module 'fastify' {
  interface FastifyRequest {
    partnerKeyId?: string
  }
}

export async function authenticatePartner(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const key = extractPartnerKey(request.headers as Record<string, string | undefined>)
  const row = key
    ? await prisma.partnerApiKey.findUnique({ where: { keyHash: hashPartnerKey(key) } })
    : null

  const blocked = partnerAuthBlocked({
    keyProvided: Boolean(key),
    keyFound: Boolean(row),
    status: row?.status,
  })
  if (blocked) {
    return reply.code(blocked.status).send({ error: blocked.error })
  }

  request.partnerKeyId = row!.id
  await prisma.partnerApiKey.update({
    where: { id: row!.id },
    data: { requestCount: { increment: 1 }, lastUsedAt: new Date() },
  })
}
