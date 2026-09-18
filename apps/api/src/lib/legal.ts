import type { Country } from '@prisma/client'
import {
  AGREEMENT_STACK,
  BUYER_LICENCE_AGREEMENT_VERSION,
  GLOBAL_RIGHTS_STANDARD,
  overlayKindForCountry,
  overlayContributorAllowedBlocked,
  placeholderCommissionedPhotoPrompt,
  placeholderDataTransferNotice,
  placeholderExtraNotice,
  PRIORITY_LAW_LABEL,
  PRIORITY_OVERLAY_COUNTRIES,
  RIGHTS_CLEARANCE_CONTACT_COPY,
  consentWithdrawalEffect,
  aiTrainingProductRules,
  isPriorityOverlayCountry,
  creatorCountryAllowed,
  type LegalOverlayDto,
  type LegalOverlayKind,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { ALL_COUNTRIES } from '../data/countries.js'

export { BUYER_LICENCE_AGREEMENT_VERSION }

export function serializeLegalOverlay(
  overlay: {
    countryCode: string
    overlayKind: string
    contributorAllowed: boolean
    dataTransferNotice: string
    commissionedPhotoPrompt: string
    extraNotice: string | null
    biometricForbidden: boolean
    counselStatus: string
    lawLabel: string | null
  },
  country?: Pick<Country, 'name' | 'region' | 'contributorEligible'> | null,
): LegalOverlayDto {
  return {
    countryCode: overlay.countryCode,
    countryName: country?.name,
    region: country?.region,
    overlayKind: overlay.overlayKind as LegalOverlayKind,
    contributorAllowed: overlay.contributorAllowed,
    countryContributorEligible: country?.contributorEligible ?? false,
    dataTransferNotice: overlay.dataTransferNotice,
    commissionedPhotoPrompt: overlay.commissionedPhotoPrompt,
    extraNotice: overlay.extraNotice,
    biometricForbidden: overlay.biometricForbidden,
    counselStatus: overlay.counselStatus === 'counsel_signed' ? 'counsel_signed' : 'placeholder',
    lawLabel: overlay.lawLabel,
  }
}

export function overlaySeedForCountry(country: {
  code: string
  name: string
  region: string
  contributorEligible: boolean
}) {
  const overlayKind = overlayKindForCountry(country)
  const lawLabel = isPriorityOverlayCountry(country.code) ? PRIORITY_LAW_LABEL[country.code] : null
  const contributorAllowed = overlayKind !== 'buyer'
  return {
    countryCode: country.code,
    overlayKind,
    contributorAllowed,
    dataTransferNotice: placeholderDataTransferNotice({
      countryName: country.name,
      kind: overlayKind,
      lawLabel,
    }),
    commissionedPhotoPrompt: placeholderCommissionedPhotoPrompt(),
    extraNotice: placeholderExtraNotice(overlayKind),
    biometricForbidden: true,
    counselStatus: 'placeholder' as const,
    lawLabel,
  }
}

export async function seedLegalOverlays() {
  const countries = await prisma.country.findMany()
  const source = countries.length > 0 ? countries : ALL_COUNTRIES
  for (const country of source) {
    const seed = overlaySeedForCountry(country)
    await prisma.legalOverlay.upsert({
      where: { countryCode: seed.countryCode },
      create: seed,
      update: {
        overlayKind: seed.overlayKind,
        contributorAllowed: seed.contributorAllowed,
        biometricForbidden: true,
        lawLabel: seed.lawLabel,
        extraNotice: seed.extraNotice,
        dataTransferNotice: seed.dataTransferNotice,
        commissionedPhotoPrompt: seed.commissionedPhotoPrompt,
      },
    })
  }
}

export async function loadOverlay(countryCode?: string | null) {
  if (!countryCode) return null
  return prisma.legalOverlay.findUnique({
    where: { countryCode: countryCode.toUpperCase() },
    include: { country: true },
  })
}

export async function assertCreatorCountry(accountType: string | undefined, countryCode?: string) {
  if (!accountType || !['photographer', 'photo_influencer', 'contributor'].includes(accountType)) {
    return null
  }
  if (!countryCode) {
    throw Object.assign(new Error('Contributors must select an African country'), { statusCode: 400 })
  }
  const country = await prisma.country.findUnique({
    where: { code: countryCode.toUpperCase() },
    include: { legalOverlay: true },
  })
  if (!country?.enabled) {
    throw Object.assign(new Error('Vuekumi only accepts contributors from African countries'), { statusCode: 400 })
  }
  const overlayAllowed = country.legalOverlay?.contributorAllowed ?? country.contributorEligible
  if (!creatorCountryAllowed({
    accountType,
    countryContributorEligible: country.contributorEligible,
    overlayContributorAllowed: overlayAllowed,
    region: country.region,
  })) {
    throw Object.assign(
      new Error('Vuekumi only accepts contributors from African countries'),
      { statusCode: 400 },
    )
  }
  const blocked = overlayContributorAllowedBlocked({
    region: country.region,
    contributorEligible: country.contributorEligible,
    overlayContributorAllowed: overlayAllowed,
  })
  if (blocked) throw Object.assign(new Error(blocked), { statusCode: 400 })
  return country
}

export function globalRightsStandardDto() {
  return {
    ...GLOBAL_RIGHTS_STANDARD,
    priorityCountries: [...PRIORITY_OVERLAY_COUNTRIES],
    agreementStack: AGREEMENT_STACK,
    rightsClearanceContactCopy: RIGHTS_CLEARANCE_CONTACT_COPY,
    withdrawal: consentWithdrawalEffect(),
    aiTraining: aiTrainingProductRules(),
  }
}
