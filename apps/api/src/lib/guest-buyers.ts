import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma.js'
import { ensureUserProfile } from './subscriptions.js'

export class GuestBuyerError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function displayName(input: { name?: string | null; email: string }) {
  const named = input.name?.trim()
  if (named) return named.slice(0, 120)
  const local = input.email.split('@')[0]?.trim()
  return (local && local.length > 0 ? local : 'Guest buyer').slice(0, 120)
}

/**
 * Find or create a passwordless `user` buyer for guest checkout.
 * Existing password accounts must log in — never silently take over.
 */
export async function ensureGuestBuyer(input: {
  email: string
  name?: string | null
}) {
  const email = normalizeEmail(input.email)
  if (!email.includes('@')) throw new GuestBuyerError('A valid email is required for guest checkout')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.status === 'suspended') {
      throw new GuestBuyerError('This account is suspended', 403)
    }
    if (existing.passwordHash) {
      throw new GuestBuyerError('An account already exists for this email — log in to purchase', 409)
    }
    if (existing.accountType !== 'user' && existing.accountType !== 'agency') {
      throw new GuestBuyerError('Log in with this email to continue as a contributor or model', 409)
    }
    await ensureUserProfile(existing.id)
    return existing
  }

  const created = await prisma.user.create({
    data: {
      email,
      name: displayName({ name: input.name, email }),
      accountType: 'user',
      status: 'active',
      // Passwordless guest — claim later via password reset / register with same email blocked.
      passwordHash: null,
    },
  })
  await ensureUserProfile(created.id)
  return created
}

/** Opaque marker stored only for audit — not a secret. */
export function guestCheckoutAuditToken() {
  return createHash('sha256').update(randomBytes(16)).digest('hex').slice(0, 16)
}
