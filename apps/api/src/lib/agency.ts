import type { AccountType, AgencyRole } from '@vuekumi/shared'

export class AgencyError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'AgencyError'
    this.statusCode = statusCode
  }
}

export const ROLE_RANK: Record<AgencyRole, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  member: 20,
  viewer: 10,
}

export function roleAtLeast(role: AgencyRole, min: AgencyRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export function canManageTeam(role: AgencyRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canPurchase(role: AgencyRole): boolean {
  return roleAtLeast(role, 'member')
}

export function canQuote(role: AgencyRole): boolean {
  return roleAtLeast(role, 'manager')
}

export function seatsRemaining(input: {
  seatLimit: number
  memberCount: number
  pendingInviteCount: number
}): number {
  return input.seatLimit - input.memberCount - input.pendingInviteCount
}

export function inviteAccountBlocked(accountType: AccountType | undefined): string | null {
  if (!accountType) return null
  if (accountType === 'contributor') return 'Community contributors cannot join an agency'
  if (accountType === 'photographer') return 'Photographers cannot join an agency'
  if (accountType === 'admin') return 'Administrators cannot join an agency'
  if (accountType === 'model') return 'Models cannot join an agency'
  return null
}

export function canChangeRole(actor: AgencyRole, target: AgencyRole, next: AgencyRole): boolean {
  if (target === 'owner' || next === 'owner') return false
  if (actor === 'owner') return true
  if (actor === 'admin') return target !== 'admin' && next !== 'admin'
  return false
}

export function canRemoveMember(actor: AgencyRole, target: AgencyRole, isSelf: boolean): boolean {
  if (target === 'owner') return false
  if (isSelf && actor !== 'owner') return true
  if (!canManageTeam(actor)) return false
  if (actor === 'admin' && target === 'admin') return false
  return true
}

export function assertAgencyActive(status: string): void {
  if (status === 'pending') {
    throw new AgencyError('Your agency is pending approval. Licensing is paused until an admin activates it.', 403)
  }
  if (status === 'suspended') {
    throw new AgencyError('Your agency is suspended.', 403)
  }
}
