import { z } from 'zod'

export const agencyRoleSchema = z.enum(['owner', 'admin', 'manager', 'member', 'viewer'])
export const assignableAgencyRoleSchema = z.enum(['admin', 'manager', 'member', 'viewer'])

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: assignableAgencyRoleSchema.optional(),
})

export const updateMemberRoleSchema = z.object({
  role: assignableAgencyRoleSchema,
})

export const acceptInviteSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).optional(),
  country: z.string().min(2).max(2).optional(),
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
