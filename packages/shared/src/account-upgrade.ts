import { z } from 'zod'

/** Dec-Upgrade: Photo Influencer may upgrade into these roles on the same email. */
export const ACCOUNT_UPGRADE_TARGETS = ['photographer', 'contributor', 'model'] as const
export type AccountUpgradeTarget = (typeof ACCOUNT_UPGRADE_TARGETS)[number]

export const accountUpgradeSchema = z.object({
  targetAccountType: z.enum(ACCOUNT_UPGRADE_TARGETS),
  acceptAgreement: z.literal(true),
})
export type AccountUpgradeInput = z.infer<typeof accountUpgradeSchema>

export function accountUpgradeBlocked(
  currentAccountType: string | null | undefined,
  target: AccountUpgradeTarget,
): string | undefined {
  if (currentAccountType !== 'photo_influencer') {
    return 'Only Photo Influencer accounts can use same-email upgrade.'
  }
  if (!(ACCOUNT_UPGRADE_TARGETS as readonly string[]).includes(target)) {
    return 'Choose Photographer, Contributor, or Model as the upgrade target.'
  }
  return undefined
}
