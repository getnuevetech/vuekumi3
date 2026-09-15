import { permissionStateSchema } from './permissions.js'
import { z } from 'zod'

export const grantLicenseTypeSchema = z.enum([
  'royalty_free',
  'commercial',
  'extended',
  'editorial',
  'rights_managed',
  'exclusive',
])

export const checkoutProviderSchema = z.enum(['stripe', 'flutterwave'])

export const purchaseLicenseSchema = z.object({
  type: grantLicenseTypeSchema,
  currency: z.string().min(3).max(3).optional(),
  provider: checkoutProviderSchema.optional(),
})

export const acceptQuoteSchema = z.object({
  currency: z.string().min(3).max(3).optional(),
  provider: checkoutProviderSchema.optional(),
})

export const rightsManagedQuoteSchema = z.object({
  territory: z.string().min(2).max(120),
  duration: z.string().min(2).max(120),
  channels: z.string().min(2).max(240),
  notes: z.string().max(2000).optional(),
})

export const reviewModelReleaseSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  notes: z.string().max(2000).optional(),
})

export const decideModerationSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(2000).optional(),
})

export const quoteDecisionSchema = z.object({
  quoteUsd: z.number().positive().optional(),
  status: z.enum(['quoted', 'accepted', 'declined']).optional(),
  notes: z.string().max(2000).optional(),
})

export const patchRightsSchema = z.object({
  copyrightVerified: z.boolean().optional(),
  copyrightHolder: z.string().max(200).optional(),
  platformRightsOk: z.boolean().optional(),
  modelReleaseRequired: z.boolean().optional(),
  exclusiveAvailable: z.boolean().optional(),
  permissionState: permissionStateSchema.optional(),
  restrictionNotes: z.string().trim().max(2000).optional().nullable(),
})

export const submitPhotoSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(80),
  country: z.string().min(2).max(80),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  licenseType: z.enum(['free', 'premium']),
  price: z.number().min(0).max(10000).optional(),
  hasRecognizablePeople: z.boolean(),
  exclusiveAvailable: z.boolean().optional(),
  permissionState: permissionStateSchema.optional(),
  restrictionNotes: z.string().trim().max(2000).optional().nullable(),
  copyrightHolder: z.string().min(2).max(200),
  copyrightAttested: z.literal(true),
  modelReleaseFileName: z.string().max(200).optional(),
  modelReleaseNotes: z.string().max(2000).optional(),
  src: z.string().max(500).optional(),
  originalKey: z.string().min(8).max(400).optional(),
})

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(100),
})

export type PurchaseLicenseInput = z.infer<typeof purchaseLicenseSchema>
export type RightsManagedQuoteInput = z.infer<typeof rightsManagedQuoteSchema>
export type SubmitPhotoInput = z.infer<typeof submitPhotoSchema>
export type PresignUploadInput = z.infer<typeof presignUploadSchema>
