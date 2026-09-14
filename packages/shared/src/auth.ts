import { z } from 'zod'

export const accountTypeSchema = z.enum(['admin', 'contributor', 'user', 'agency'])

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(120),
  accountType: z.enum(['contributor', 'user', 'agency']),
  country: z.string().min(2).max(2).optional(),
  acceptAgreement: z.boolean().optional(),
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

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type OAuthDevInput = z.infer<typeof oauthDevSchema>
