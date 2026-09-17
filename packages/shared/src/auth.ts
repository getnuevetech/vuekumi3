import { z } from 'zod'
import { accountTypeSchema, publicRegisterAccountTypeSchema } from './accounts.js'
import { bookingAvailabilitySchema } from './bookings.js'
import { creatorKindSchema } from './creators.js'

export { accountTypeSchema, publicRegisterAccountTypeSchema }

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(120),
  accountType: publicRegisterAccountTypeSchema,
  country: z.string().min(2).max(2).optional(),
  acceptAgreement: z.boolean().optional(),
  creatorKind: creatorKindSchema.optional(),
})

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
  name: z.string().min(1).max(120).optional(),
  country: z.string().length(2).optional().or(z.literal('')),
  avatarUrl: z.string().max(500).optional().or(z.literal('')),
  bio: z.string().max(1000).optional().or(z.literal('')),
  location: z.string().max(120).optional().or(z.literal('')),
  handle: z.string().min(3).max(40).optional(),
  creatorKind: creatorKindSchema.optional(),
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
