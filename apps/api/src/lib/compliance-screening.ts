import {
  COMPLIANCE_SCREENING_SETTING_KEY,
  recordComplianceScreeningSchema,
  serializeComplianceScreening,
  serializeCountryScreeningProviderSlot,
  upsertCountryScreeningProviderSchema,
  type ComplianceScreeningEvidenceDto,
  type ComplianceScreeningProvider,
  type CountryScreeningProviderSlotDto,
  type RecordComplianceScreeningInput,
  type UpsertCountryScreeningProviderInput,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { getSetting } from './settings.js'
import { getIdentityVerificationStatus } from './identity-verification.js'

export class ComplianceScreeningError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 403) {
    super(message)
    this.statusCode = statusCode
  }
}

/** Default OFF — T9: no production activation without KYC partners + counsel. */
export async function isComplianceScreeningEnabled(): Promise<boolean> {
  const raw = (await getSetting(COMPLIANCE_SCREENING_SETTING_KEY)) ?? 'false'
  return raw.trim().toLowerCase() === 'true' || raw.trim() === '1'
}

export async function assertComplianceScreeningEnabled() {
  if (!(await isComplianceScreeningEnabled())) {
    throw new ComplianceScreeningError(
      'Compliance screening is disabled. T9 evidence API stays OFF until KYC partners, country-matrix provider coverage, and counsel activation are signed.',
      403,
    )
  }
}

/** No live provider is registered while the flag is OFF. Do not invent a vendor. */
export function resolveComplianceProvider(): ComplianceScreeningProvider | null {
  return null
}

export async function startComplianceScreening(input: {
  subjectType: RecordComplianceScreeningInput['subjectType']
  subjectUserId?: string | null
  countryCode?: string | null
}): Promise<never> {
  await assertComplianceScreeningEnabled()
  const provider = resolveComplianceProvider()
  if (!provider) {
    throw new ComplianceScreeningError(
      'No compliance screening provider is configured. Register counsel-approved KYC partners before enabling the flag.',
      503,
    )
  }
  await provider.screen(input)
  throw new ComplianceScreeningError('Compliance screening provider returned no evidence', 503)
}

export async function recordComplianceScreening(
  input: RecordComplianceScreeningInput & { recordedById?: string | null },
): Promise<ComplianceScreeningEvidenceDto> {
  await assertComplianceScreeningEnabled()
  const body = recordComplianceScreeningSchema.parse(input)
  if (body.subjectUserId) {
    const user = await prisma.user.findUnique({ where: { id: body.subjectUserId }, select: { id: true } })
    if (!user) throw new ComplianceScreeningError('Subject user not found', 404)
  }
  if (body.countryCode) {
    const country = await prisma.country.findUnique({
      where: { code: body.countryCode.toUpperCase() },
      select: { code: true },
    })
    if (!country) throw new ComplianceScreeningError('Country not found', 404)
  }

  const row = await prisma.complianceScreeningEvidence.upsert({
    where: {
      vendor_screeningId: {
        vendor: body.vendor,
        screeningId: body.screeningId,
      },
    },
    create: {
      screeningId: body.screeningId,
      vendor: body.vendor,
      subjectType: body.subjectType,
      subjectUserId: body.subjectUserId ?? null,
      recordedById: input.recordedById ?? null,
      countryCode: body.countryCode?.toUpperCase() ?? null,
      result: body.result,
      notes: body.notes ?? null,
      screenedAt: body.screenedAt ? new Date(body.screenedAt) : null,
    },
    update: {
      subjectType: body.subjectType,
      subjectUserId: body.subjectUserId ?? null,
      recordedById: input.recordedById ?? null,
      countryCode: body.countryCode?.toUpperCase() ?? null,
      result: body.result,
      notes: body.notes ?? null,
      screenedAt: body.screenedAt ? new Date(body.screenedAt) : null,
    },
  })
  return serializeComplianceScreening(row)
}

export async function listComplianceScreening(filter: {
  subjectUserId?: string
  countryCode?: string
}): Promise<ComplianceScreeningEvidenceDto[]> {
  await assertComplianceScreeningEnabled()
  const rows = await prisma.complianceScreeningEvidence.findMany({
    where: {
      ...(filter.subjectUserId ? { subjectUserId: filter.subjectUserId } : {}),
      ...(filter.countryCode ? { countryCode: filter.countryCode.toUpperCase() } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.map(serializeComplianceScreening)
}

export async function listCountryScreeningProviders(countryCode?: string): Promise<CountryScreeningProviderSlotDto[]> {
  const rows = await prisma.countryScreeningProviderSlot.findMany({
    where: countryCode ? { countryCode: countryCode.toUpperCase() } : undefined,
    orderBy: [{ countryCode: 'asc' }, { screeningFunction: 'asc' }],
  })
  return rows.map(serializeCountryScreeningProviderSlot)
}

export async function upsertCountryScreeningProvider(
  input: UpsertCountryScreeningProviderInput,
): Promise<CountryScreeningProviderSlotDto> {
  const body = upsertCountryScreeningProviderSchema.parse(input)
  const code = body.countryCode.toUpperCase()
  const country = await prisma.country.findUnique({ where: { code }, select: { code: true } })
  if (!country) throw new ComplianceScreeningError('Country not found', 404)

  const row = await prisma.countryScreeningProviderSlot.upsert({
    where: {
      countryCode_screeningFunction: {
        countryCode: code,
        screeningFunction: body.screeningFunction,
      },
    },
    create: {
      countryCode: code,
      screeningFunction: body.screeningFunction,
      providerSlug: body.providerSlug ?? null,
      evidenceUrl: body.evidenceUrl ?? null,
      notes: body.notes ?? null,
    },
    update: {
      providerSlug: body.providerSlug === undefined ? undefined : body.providerSlug,
      evidenceUrl: body.evidenceUrl === undefined ? undefined : body.evidenceUrl,
      notes: body.notes === undefined ? undefined : body.notes,
    },
  })
  return serializeCountryScreeningProviderSlot(row)
}

export async function getComplianceScreeningStatus() {
  const enabled = await isComplianceScreeningEnabled()
  return {
    enabled,
    providerConfigured: resolveComplianceProvider() !== null,
    countryOnlyReject: false as const,
    listPayloadRetained: false as const,
    inventsVendor: false as const,
    message: enabled
      ? 'Compliance screening flag is ON. Vendor calls still require registered KYC partners per country-matrix function.'
      : 'Compliance screening is OFF (T9 default). Evidence API refuses writes until counsel activation. Country matrix may still record provider coverage slots.',
  }
}

/** Combined T9 + Bio readiness for admin — flags stay OFF without providers. */
export async function getComplianceReadiness() {
  const [screening, identity, slotCount, namedSlots] = await Promise.all([
    getComplianceScreeningStatus(),
    getIdentityVerificationStatus(),
    prisma.countryScreeningProviderSlot.count(),
    prisma.countryScreeningProviderSlot.count({ where: { providerSlug: { not: null } } }),
  ])
  return {
    screening,
    identity,
    matrix: {
      slotCount,
      namedProviderSlots: namedSlots,
      unnamedSlots: slotCount - namedSlots,
    },
    activationAllowed: false as const,
    message:
      'T9 and Bio stay OFF until counsel-approved KYC/identity providers are registered. Do not invent vendors or enable flags from this checklist.',
  }
}
