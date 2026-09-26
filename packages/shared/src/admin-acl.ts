import { z } from 'zod'
import type { AdminRole, AuthUser } from './types.js'

export const ADMIN_CAPABILITIES = [
  'metrics.view',
  'accounts.users.list',
  'accounts.users.write',
  'accounts.photographers.list',
  'accounts.photographers.write',
  'accounts.influencers.list',
  'accounts.influencers.write',
  'accounts.contributors.list',
  'accounts.contributors.write',
  'accounts.agencies.list',
  'accounts.agencies.write',
  'accounts.agencies.activate',
  'accounts.models.list',
  'accounts.models.write',
  'accounts.admins.list',
  'accounts.admins.manage',
  'accounts.password_reset',
  'accounts.read',
  'content.list',
  'content.read',
  'content.rights.edit',
  'content.two_party.verify',
  'content.model_release.review',
  'content.commercial_lock',
  'content.rights_ledger.read',
  'content.impersonate_creator',
  'content.featured',
  'moderation.list',
  'moderation.decide',
  'reports.list',
  'reports.decide',
  'quotes.list',
  'quotes.manage',
  'bookings.list',
  'campaigns.list',
  'campaigns.close',
  'representation.list',
  'representation.decide',
  'representation.inquiry.manage',
  'partner.keys.list',
  'partner.keys.create',
  'partner.keys.revoke',
  'payouts.list',
  'payouts.pay',
  'payouts.reject',
  'payouts.holds.manage',
  'plans.manage',
  'geo.countries.list',
  'geo.countries.write',
  'geo.activation.research',
  'geo.activation.gate.approve',
  'geo.activation.submit',
  'geo.activation.authorize',
  'geo.activation.suspend',
  'geo.fx.list',
  'geo.fx.sync',
  'geo.fx.override',
  'integrations.gateways.read',
  'integrations.gateways.write',
  'integrations.ai.read',
  'integrations.ai.write',
  'settings.read',
  'settings.write',
  'settings.email.test',
  'audit.read',
  'dmca.manage',
] as const

export const adminCapabilitySchema = z.enum(ADMIN_CAPABILITIES)
export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number]

export const ADMIN_CAPABILITY_GROUPS: { label: string; keys: AdminCapability[] }[] = [
  { label: 'Overview', keys: ['metrics.view'] },
  {
    label: 'Accounts',
    keys: [
      'accounts.users.list',
      'accounts.users.write',
      'accounts.photographers.list',
      'accounts.photographers.write',
      'accounts.influencers.list',
      'accounts.influencers.write',
      'accounts.contributors.list',
      'accounts.contributors.write',
      'accounts.agencies.list',
      'accounts.agencies.write',
      'accounts.agencies.activate',
      'accounts.models.list',
      'accounts.models.write',
      'accounts.admins.list',
      'accounts.admins.manage',
      'accounts.password_reset',
      'accounts.read',
    ],
  },
  {
    label: 'Content and rights',
    keys: [
      'content.list',
      'content.read',
      'content.rights.edit',
      'content.two_party.verify',
      'content.model_release.review',
      'content.commercial_lock',
      'content.rights_ledger.read',
      'content.impersonate_creator',
      'content.featured',
      'moderation.list',
      'moderation.decide',
      'reports.list',
      'reports.decide',
      'quotes.list',
      'quotes.manage',
      'bookings.list',
      'campaigns.list',
      'campaigns.close',
      'dmca.manage',
    ],
  },
  {
    label: 'VueQuatro / partner',
    keys: [
      'representation.list',
      'representation.decide',
      'representation.inquiry.manage',
      'partner.keys.list',
      'partner.keys.create',
      'partner.keys.revoke',
    ],
  },
  {
    label: 'Money',
    keys: ['payouts.list', 'payouts.pay', 'payouts.reject', 'payouts.holds.manage', 'plans.manage'],
  },
  {
    label: 'Platform',
    keys: [
      'geo.countries.list',
      'geo.countries.write',
      'geo.activation.research',
      'geo.activation.gate.approve',
      'geo.activation.submit',
      'geo.activation.authorize',
      'geo.activation.suspend',
      'geo.fx.list',
      'geo.fx.sync',
      'geo.fx.override',
      'integrations.gateways.read',
      'integrations.gateways.write',
      'integrations.ai.read',
      'integrations.ai.write',
      'settings.read',
      'settings.write',
      'settings.email.test',
      'audit.read',
    ],
  },
]

const SUPPORT: AdminCapability[] = [
  'metrics.view',
  'accounts.users.list',
  'accounts.users.write',
  'accounts.photographers.list',
  'accounts.photographers.write',
  'accounts.influencers.list',
  'accounts.influencers.write',
  'accounts.contributors.list',
  'accounts.contributors.write',
  'accounts.agencies.list',
  'accounts.agencies.write',
  'accounts.models.list',
  'accounts.models.write',
  'accounts.admins.list',
  'accounts.password_reset',
  'accounts.read',
  'content.list',
  'content.read',
  'geo.countries.list',
  'geo.activation.research',
  'geo.fx.list',
]

const MODERATOR: AdminCapability[] = [
  ...SUPPORT,
  'content.rights.edit',
  'content.two_party.verify',
  'content.model_release.review',
  'content.commercial_lock',
  'content.rights_ledger.read',
  'content.featured',
  'moderation.list',
  'moderation.decide',
  'reports.list',
  'reports.decide',
  'quotes.list',
  'quotes.manage',
  'bookings.list',
  'campaigns.list',
  'campaigns.close',
  'dmca.manage',
  'representation.list',
  'representation.decide',
  'representation.inquiry.manage',
]

const FINANCE: AdminCapability[] = [
  'metrics.view',
  'quotes.list',
  'payouts.list',
  'payouts.pay',
  'payouts.reject',
  'payouts.holds.manage',
  'geo.fx.list',
  'geo.fx.sync',
  'geo.fx.override',
  'accounts.read',
  'plans.manage',
]

export const PRESET_CAPABILITIES: Record<AdminRole, readonly AdminCapability[]> = {
  super_admin: ADMIN_CAPABILITIES,
  moderator: MODERATOR,
  finance: FINANCE,
  support: SUPPORT,
}

export const adminCreateAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120).optional(),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  country: z.string().length(2).optional(),
  preset: z.enum(['super_admin', 'moderator', 'finance', 'support']),
  capabilities: z.array(adminCapabilitySchema).optional(),
}).superRefine((value, ctx) => {
  const first = value.firstName?.trim()
  const last = value.lastName?.trim()
  if ((first && !last) || (!first && last)) {
    ctx.addIssue({ code: 'custom', message: 'First and last name are required', path: ['lastName'] })
  }
  if (!first && !last && !value.name?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'First and last name are required', path: ['firstName'] })
  }
})
export type AdminCreateAdminInput = z.infer<typeof adminCreateAdminSchema>

export const adminPatchAdminSchema = z.object({
  preset: z.enum(['super_admin', 'moderator', 'finance', 'support']).optional(),
  capabilities: z.array(adminCapabilitySchema).optional(),
})
export type AdminPatchAdminInput = z.infer<typeof adminPatchAdminSchema>

export function capabilitiesForPreset(preset: AdminRole): AdminCapability[] {
  return [...PRESET_CAPABILITIES[preset]]
}

export function resolveAdminCapabilities(input: {
  adminRole?: AdminRole | null
  capabilities?: string[] | null
  capabilitiesCustomized?: boolean | null
}): AdminCapability[] {
  if (input.adminRole === 'super_admin' && !input.capabilitiesCustomized) {
    return [...ADMIN_CAPABILITIES]
  }
  if (input.capabilitiesCustomized && input.capabilities?.length) {
    return ADMIN_CAPABILITIES.filter((k) => input.capabilities!.includes(k))
  }
  if (input.adminRole && PRESET_CAPABILITIES[input.adminRole]) {
    return [...PRESET_CAPABILITIES[input.adminRole]]
  }
  return [...PRESET_CAPABILITIES.support]
}

export function adminHas(
  user: Pick<AuthUser, 'accountType' | 'adminRole' | 'adminCapabilities' | 'adminCapabilitiesCustomized'> | null | undefined,
  key: AdminCapability,
): boolean {
  if (!user || user.accountType !== 'admin') return false
  if (user.adminRole === 'super_admin' && !user.adminCapabilitiesCustomized) return true
  const caps = resolveAdminCapabilities({
    adminRole: user.adminRole,
    capabilities: user.adminCapabilities,
    capabilitiesCustomized: user.adminCapabilitiesCustomized,
  })
  return caps.includes(key)
}

export function canImpersonateCreator(
  user: Pick<AuthUser, 'accountType' | 'adminRole' | 'adminCapabilities' | 'adminCapabilitiesCustomized'> | null | undefined,
): boolean {
  if (!user) return false
  if (user.accountType === 'photographer' || user.accountType === 'photo_influencer' || user.accountType === 'contributor') return true
  return adminHas(user, 'content.impersonate_creator')
}

export function sameCapabilities(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((k) => set.has(k))
}

export function accountListCapability(kind: 'users' | 'contributors' | 'photographers' | 'influencers' | 'agencies' | 'admins' | 'models'): AdminCapability {
  switch (kind) {
    case 'users':
      return 'accounts.users.list'
    case 'photographers':
      return 'accounts.photographers.list'
    case 'influencers':
      return 'accounts.influencers.list'
    case 'contributors':
      return 'accounts.contributors.list'
    case 'agencies':
      return 'accounts.agencies.list'
    case 'admins':
      return 'accounts.admins.list'
    case 'models':
      return 'accounts.models.list'
  }
}

export function accountWriteCapability(accountType: AuthUser['accountType']): AdminCapability {
  switch (accountType) {
    case 'user':
      return 'accounts.users.write'
    case 'photographer':
      return 'accounts.photographers.write'
    case 'photo_influencer':
      return 'accounts.influencers.write'
    case 'contributor':
      return 'accounts.contributors.write'
    case 'agency':
      return 'accounts.agencies.write'
    case 'model':
      return 'accounts.models.write'
    case 'admin':
      return 'accounts.admins.manage'
  }
}

export function storedAdminCapabilities(
  preset: AdminRole,
  capabilities?: readonly string[] | null,
): { capabilities: AdminCapability[]; capabilitiesCustomized: boolean } {
  const presetCaps = capabilitiesForPreset(preset)
  if (!capabilities) {
    return { capabilities: presetCaps, capabilitiesCustomized: false }
  }
  const next = ADMIN_CAPABILITIES.filter((k) => capabilities.includes(k))
  const customized = !sameCapabilities(next, presetCaps)
  return {
    capabilities: customized ? next : presetCaps,
    capabilitiesCustomized: customized,
  }
}

export function lastSuperAdminBlocked(opts: {
  isLastSuperAdmin: boolean
  nextRole?: AdminRole | null
  nextCustomized?: boolean
  nextCapabilities?: string[] | null
  nextStatus?: string | null
}): { status: number; error: string } | null {
  if (!opts.isLastSuperAdmin) return null
  if (opts.nextStatus && opts.nextStatus !== 'active') {
    return { status: 400, error: 'Cannot suspend the last super-admin' }
  }
  if (opts.nextRole && opts.nextRole !== 'super_admin') {
    return { status: 400, error: 'Cannot demote the last super-admin' }
  }
  if (opts.nextCustomized && opts.nextCapabilities && !opts.nextCapabilities.includes('accounts.admins.manage')) {
    return { status: 400, error: 'The last super-admin must keep staff management access' }
  }
  return null
}

export function selfCapabilityEditBlocked(actorId: string, targetId: string): { status: number; error: string } | null {
  if (actorId === targetId) {
    return { status: 400, error: 'You cannot change your own capabilities' }
  }
  return null
}

export const ADMIN_NAV_CAPABILITY: Record<string, AdminCapability> = {
  '/admin': 'metrics.view',
  '/admin/menu': 'content.featured',
  '/admin/users': 'accounts.users.list',
  '/admin/profile-fields': 'accounts.users.list',
  '/admin/photographers': 'accounts.photographers.list',
  '/admin/influencers': 'accounts.influencers.list',
  '/admin/contributors': 'accounts.contributors.list',
  '/admin/agencies': 'accounts.agencies.list',
  '/admin/models': 'accounts.models.list',
  '/admin/admins': 'accounts.admins.list',
  '/admin/content': 'content.list',
  '/admin/homepage': 'content.featured',
  '/admin/featured': 'content.featured',
  '/admin/site': 'content.featured',
  '/admin/moderation': 'moderation.list',
  '/admin/reports': 'reports.list',
  '/admin/dmca': 'dmca.manage',
  '/admin/quotes': 'quotes.list',
  '/admin/bookings': 'bookings.list',
  '/admin/campaigns': 'campaigns.list',
  '/admin/representation': 'representation.list',
  '/admin/partner-api': 'partner.keys.list',
  '/admin/payouts': 'payouts.list',
  '/admin/holds': 'payouts.holds.manage',
  '/admin/plans': 'plans.manage',
  '/admin/shares': 'plans.manage',
  '/admin/countries': 'geo.countries.list',
  '/admin/countries/activation': 'geo.activation.research',
  '/admin/legal': 'geo.countries.list',
  '/admin/rates': 'geo.fx.list',
  '/admin/payout-rates': 'geo.fx.list',
  '/admin/gateways': 'integrations.gateways.read',
  '/admin/ai': 'integrations.ai.read',
  '/admin/settings': 'settings.read',
}

export function firstAdminPath(user: AuthUser): string {
  const order = Object.keys(ADMIN_NAV_CAPABILITY)
  for (const path of order) {
    if (adminHas(user, ADMIN_NAV_CAPABILITY[path]!)) return path
  }
  return '/account'
}
