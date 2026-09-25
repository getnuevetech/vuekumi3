import { z } from 'zod'
import { accountTypeSchema, publicRegisterAccountTypeSchema } from './accounts.js'
import { bookingAvailabilitySchema } from './bookings.js'

const legacyName = z.string().trim().min(1).max(120).optional()
const givenName = z.string().trim().min(1).max(60).optional()

function requirePersonName(
  value: { name?: string; firstName?: string; lastName?: string },
  ctx: z.RefinementCtx,
) {
  const first = value.firstName?.trim()
  const last = value.lastName?.trim()
  const legacy = value.name?.trim()
  if ((first && !last) || (!first && last)) {
    ctx.addIssue({ code: 'custom', message: 'First and last name are required', path: ['lastName'] })
  }
  if (!first && !last && !legacy) {
    ctx.addIssue({ code: 'custom', message: 'First and last name are required', path: ['firstName'] })
  }
}

export { accountTypeSchema, publicRegisterAccountTypeSchema }

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: legacyName,
  firstName: givenName,
  lastName: givenName,
  accountType: publicRegisterAccountTypeSchema,
  country: z.string().min(2).max(2).optional(),
  acceptAgreement: z.boolean().optional(),
}).superRefine(requirePersonName)

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const oauthDevSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
})

export const updateProfileSchema = z.object({
  name: legacyName,
  firstName: givenName,
  lastName: givenName,
  country: z.string().length(2).optional().or(z.literal('')),
  avatarUrl: z.string().max(500).optional().or(z.literal('')),
  bio: z.string().max(1000).optional().or(z.literal('')),
  location: z.string().max(120).optional().or(z.literal('')),
  phoneCountryCode: z.string().trim().max(8).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  addressLine: z.string().trim().max(160).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  handle: z.string().min(3).max(40).optional(),
  availability: bookingAvailabilitySchema.optional(),
  dayRateUsd: z.number().min(0).max(1_000_000).nullable().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type OAuthDevInput = z.infer<typeof oauthDevSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export interface SessionDto {
  id: string
  current: boolean
  ipAddress: string | null
  device: string
  createdAt: string
  lastUsedAt: string
  expiresAt: string
}
