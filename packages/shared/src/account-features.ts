import { z } from 'zod'
import type { PlanAudience } from './plan-accounts.js'

/** Account types an admin can turn on or off. Admin itself stays outside this matrix. */
export const CONFIGURABLE_ACCOUNT_TYPES = ['user', 'photographer', 'photo_influencer', 'contributor', 'agency', 'model'] as const
export type ConfigurableAccountType = (typeof CONFIGURABLE_ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABEL: Record<ConfigurableAccountType, string> = {
  user: 'Member',
  photographer: 'Photographer',
  photo_influencer: 'Photo influencer',
  contributor: 'Contributor',
  agency: 'Agency',
  model: 'Model',
}

export const ACCOUNT_FEATURE_KEYS = [
  'license_photos',
  'favorites',
  'collections',
  'follow_creators',
  'campaigns',
  'request_bookings',
  'buyer_plans',
  'upload_photos',
  'copyright_earnings',
  'public_profile',
  'photographer_listing',
  'contributor_listing',
  'receive_bookings',
  'commercial_stock',
  'ai_training_opt_in',
  'representation',
  'model_profile',
  'model_upload',
  'model_bookings',
  'agency_workspace',
  'agency_team',
  'agency_quotes',
] as const
export type AccountFeatureKey = (typeof ACCOUNT_FEATURE_KEYS)[number]

export interface AccountFeatureDef {
  key: AccountFeatureKey
  label: string
  group: string
  detail: string
}

export const ACCOUNT_FEATURES: AccountFeatureDef[] = [
  { key: 'license_photos', label: 'Licence photographs', group: 'Buyer', detail: 'Download and license photographs.' },
  { key: 'favorites', label: 'Favourites', group: 'Buyer', detail: 'Save photographs to favourites.' },
  { key: 'collections', label: 'Collections', group: 'Buyer', detail: 'Group photographs into collections.' },
  { key: 'follow_creators', label: 'Follow creators', group: 'Buyer', detail: 'Follow photographers and contributors.' },
  { key: 'campaigns', label: 'Campaigns', group: 'Buyer', detail: 'Open a campaign brief.' },
  { key: 'request_bookings', label: 'Request bookings', group: 'Buyer', detail: 'Ask a photographer or model for a booking.' },
  { key: 'buyer_plans', label: 'Buyer plans', group: 'Buyer', detail: 'Subscribe to a member or agency plan.' },
  { key: 'upload_photos', label: 'Upload photographs', group: 'Creator', detail: 'Post photographs to the library.' },
  { key: 'copyright_earnings', label: 'Copyright income', group: 'Creator', detail: 'Earn from licensed use and request a payout.' },
  { key: 'public_profile', label: 'Public profile', group: 'Creator', detail: 'Keep a public profile page.' },
  { key: 'photographer_listing', label: 'Photographer listing', group: 'Creator', detail: 'Appear in the photographers directory and homepage row.' },
  { key: 'contributor_listing', label: 'Contributor listing', group: 'Creator', detail: 'Appear in the contributors homepage row.' },
  { key: 'receive_bookings', label: 'Accept bookings', group: 'Creator', detail: 'Publish a day rate and receive hire requests.' },
  { key: 'commercial_stock', label: 'Commercial stock', group: 'Creator', detail: 'Offer commercial and exclusive licences.' },
  { key: 'ai_training_opt_in', label: 'AI-training opt-in', group: 'Creator', detail: 'Choose AI-training consent on a photograph.' },
  { key: 'representation', label: 'Representation', group: 'Creator', detail: 'Request professional representation.' },
  { key: 'model_profile', label: 'Model profile', group: 'Model', detail: 'Keep a public model profile.' },
  { key: 'model_upload', label: 'Model uploads', group: 'Model', detail: 'Upload photographs of themselves.' },
  { key: 'model_bookings', label: 'Model bookings', group: 'Model', detail: 'Accept bookings as a model.' },
  { key: 'agency_workspace', label: 'Agency workspace', group: 'Agency', detail: 'Use the shared agency workspace.' },
  { key: 'agency_team', label: 'Agency team', group: 'Agency', detail: 'Invite seats and assign roles.' },
  { key: 'agency_quotes', label: 'Agency quotes', group: 'Agency', detail: 'Request rights-managed quotes.' },
]

const BUYER: AccountFeatureKey[] = [
  'license_photos',
  'favorites',
  'collections',
  'follow_creators',
  'campaigns',
  'request_bookings',
  'buyer_plans',
]

const COMMUNITY: AccountFeatureKey[] = [
  'upload_photos',
  'copyright_earnings',
  'public_profile',
  'contributor_listing',
  'license_photos',
  'favorites',
  'collections',
  'follow_creators',
  'campaigns',
]

/** Photo Influencer Free Library tools (no commercial_stock — Dec-TierMap). */
const FREE_LIBRARY_CREATOR: AccountFeatureKey[] = [...COMMUNITY]

/** Contributor paid-tier tools (Dec-TierMap: paid library with commercial_stock). */
const PAID_CONTRIBUTOR: AccountFeatureKey[] = [
  ...COMMUNITY,
  'commercial_stock',
  'ai_training_opt_in',
]

/** Photographers / Contributors use paid tiers; Photo Influencers use Free Library only. */
export const DEFAULT_ACCOUNT_TYPE_FEATURES: Record<ConfigurableAccountType, AccountFeatureKey[]> = {
  user: BUYER,
  agency: [...BUYER, 'agency_workspace', 'agency_team', 'agency_quotes'],
  photographer: [
    'upload_photos',
    'copyright_earnings',
    'public_profile',
    'photographer_listing',
    'receive_bookings',
    'commercial_stock',
    'ai_training_opt_in',
    'representation',
    'license_photos',
    'favorites',
    'collections',
    'follow_creators',
    'campaigns',
    'request_bookings',
  ],
  photo_influencer: FREE_LIBRARY_CREATOR,
  contributor: PAID_CONTRIBUTOR,
  model: ['model_profile', 'model_upload', 'model_bookings'],
}

export function isAccountFeatureKey(value: string): value is AccountFeatureKey {
  return (ACCOUNT_FEATURE_KEYS as readonly string[]).includes(value)
}

export function accountFeatureLabel(key: string): string {
  return ACCOUNT_FEATURES.find((feature) => feature.key === key)?.label ?? key
}

export function defaultAccountFeatures(accountType: string): AccountFeatureKey[] {
  if ((CONFIGURABLE_ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
    return [...DEFAULT_ACCOUNT_TYPE_FEATURES[accountType as ConfigurableAccountType]]
  }
  return []
}

export function accountTypesForPlanAudience(audience: PlanAudience): ConfigurableAccountType[] {
  if (audience === 'buyer') return ['user', 'agency']
  if (audience === 'photographer') return ['photographer']
  if (audience === 'contributor') return ['contributor', 'photo_influencer']
  return ['model']
}

export function featuresForAccountTypes(
  accountTypes: readonly string[],
  rows: readonly { accountType: string; features: readonly string[] }[],
): AccountFeatureDef[] {
  const allowed = new Set<string>()
  for (const accountType of accountTypes) {
    const row = rows.find((item) => item.accountType === accountType)
    const keys = row?.features ?? defaultAccountFeatures(accountType)
    for (const key of keys) allowed.add(key)
  }
  return ACCOUNT_FEATURES.filter((feature) => allowed.has(feature.key))
}

export interface AccountTypeConfigDto {
  accountType: ConfigurableAccountType
  label: string
  enabled: boolean
  features: AccountFeatureKey[]
}

export const patchAccountTypesSchema = z.object({
  items: z.array(z.object({
    accountType: z.enum(CONFIGURABLE_ACCOUNT_TYPES),
    enabled: z.boolean(),
    features: z.array(z.enum(ACCOUNT_FEATURE_KEYS)).max(ACCOUNT_FEATURE_KEYS.length),
  })).min(CONFIGURABLE_ACCOUNT_TYPES.length).max(CONFIGURABLE_ACCOUNT_TYPES.length),
})
export type PatchAccountTypesInput = z.infer<typeof patchAccountTypesSchema>
