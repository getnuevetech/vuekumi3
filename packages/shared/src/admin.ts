import { z } from 'zod'
import { accountTypeSchema } from './accounts.js'
import { creatorKindSchema, type CreatorKind } from './creators.js'

export interface AdminOverviewStatsDto {
  users: number
  contributors: number
  photosLive: number
  pendingReview: number
  openRightsReports: number
  revenueMonthUsd: number
  downloads: number
  monthLabel: string
}

export interface AdminRevenuePointDto {
  month: string
  revenue: number
  payouts: number
}

export interface AdminOverviewDto {
  stats: AdminOverviewStatsDto
  series: AdminRevenuePointDto[]
}

export const ADMIN_ACCOUNT_LIST_KINDS = [
  'users',
  'contributors',
  'photographers',
  'agencies',
  'admins',
  'models',
] as const
export const adminAccountListKindSchema = z.enum(ADMIN_ACCOUNT_LIST_KINDS)
export type AdminAccountListKind = (typeof ADMIN_ACCOUNT_LIST_KINDS)[number]

export const adminCreateAccountSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  accountType: accountTypeSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  country: z.string().length(2).optional(),
  creatorKind: creatorKindSchema.optional(),
  sendPasswordReset: z.boolean().optional(),
})
export type AdminCreateAccountInput = z.infer<typeof adminCreateAccountSchema>

export const adminPatchAccountSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  country: z.string().length(2).optional().or(z.literal('')),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
})
export type AdminPatchAccountInput = z.infer<typeof adminPatchAccountSchema>

export const adminAgencyStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended']),
})
export type AdminAgencyStatusInput = z.infer<typeof adminAgencyStatusSchema>

export const AGENCY_STATUSES = ['pending', 'active', 'suspended'] as const
export type AgencyEntityStatus = (typeof AGENCY_STATUSES)[number]

export function adminCreateAccountBlocked(accountType: string): { status: number; error: string } | null {
  if (accountType === 'admin') {
    return {
      status: 403,
      error: 'Admin accounts cannot be created here. Use POST /admin/admins (accounts.admins.manage).',
    }
  }
  return null
}

export interface AdminAccountDto {
  id: string
  email: string
  name: string
  accountType: string
  status: string
  country: string | null
  joined: string
  emailVerified: boolean
  handle: string | null
  creatorKind: CreatorKind | null
  photos: number
  earnings: number
  downloads: number
  plan: string | null
  adminRole: string | null
  adminCapabilities?: import('./admin-acl.js').AdminCapability[]
  adminCapabilitiesCustomized?: boolean
  agencyId: string | null
  agencyName: string | null
  agencyStatus: AgencyEntityStatus | null
  appearances?: number
  dualRole?: boolean
}
