import {
  IDENTITY_VERIFICATION_SETTING_KEY,
  recordIdentityEvidenceSchema,
  serializeIdentityEvidence,
  type IdentityVerificationEvidenceDto,
  type IdentityVerificationProvider,
  type RecordIdentityEvidenceInput,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { getSetting } from './settings.js'

export class IdentityVerificationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 403) {
    super(message)
    this.statusCode = statusCode
  }
}

/** Default OFF — Dec-Bio: no production activation without vendor/DPA/counsel. */
export async function isIdentityVerificationEnabled(): Promise<boolean> {
  const raw = (await getSetting(IDENTITY_VERIFICATION_SETTING_KEY)) ?? 'false'
  return raw.trim().toLowerCase() === 'true' || raw.trim() === '1'
}

export async function assertIdentityVerificationEnabled() {
  if (!(await isIdentityVerificationEnabled())) {
    throw new IdentityVerificationError(
      'Identity verification is disabled. Phase 60 evidence API stays OFF until an approved identity provider, DPA, and counsel activation are signed.',
      403,
    )
  }
}

/**
 * No live provider is registered while the flag is OFF.
 * Callers must not invent a biometric vendor here.
 */
export function resolveIdentityProvider(): IdentityVerificationProvider | null {
  return null
}

export async function startIdentityVerification(input: {
  subjectUserId?: string | null
  consentVersion: string
}): Promise<never> {
  await assertIdentityVerificationEnabled()
  const provider = resolveIdentityProvider()
  if (!provider) {
    throw new IdentityVerificationError(
      'No identity verification provider is configured. Register a counsel-approved provider before enabling the flag.',
      503,
    )
  }
  // Unreachable until a provider adapter is registered after counsel approval.
  await provider.verifyIdentity(input)
  throw new IdentityVerificationError('Identity verification provider returned no evidence', 503)
}

export async function recordIdentityEvidence(
  input: RecordIdentityEvidenceInput & { recordedById?: string | null },
): Promise<IdentityVerificationEvidenceDto> {
  await assertIdentityVerificationEnabled()
  const body = recordIdentityEvidenceSchema.parse(input)
  if (body.subjectUserId) {
    const user = await prisma.user.findUnique({ where: { id: body.subjectUserId }, select: { id: true } })
    if (!user) throw new IdentityVerificationError('Subject user not found', 404)
  }
  if (body.photoId) {
    const photo = await prisma.photo.findUnique({ where: { id: body.photoId }, select: { id: true } })
    if (!photo) throw new IdentityVerificationError('Photo not found', 404)
  }
  if (body.appearanceId) {
    const appearance = await prisma.photoAppearance.findUnique({
      where: { id: body.appearanceId },
      select: { id: true },
    })
    if (!appearance) throw new IdentityVerificationError('Appearance not found', 404)
  }

  const row = await prisma.identityVerificationEvidence.upsert({
    where: {
      vendor_verificationId: {
        vendor: body.vendor,
        verificationId: body.verificationId,
      },
    },
    create: {
      verificationId: body.verificationId,
      vendor: body.vendor,
      verifiedPersonId: body.verifiedPersonId ?? null,
      subjectUserId: body.subjectUserId ?? null,
      recordedById: input.recordedById ?? null,
      photoId: body.photoId ?? null,
      appearanceId: body.appearanceId ?? null,
      result: body.result,
      manualReviewStatus: body.manualReviewStatus,
      consentVersion: body.consentVersion ?? null,
      documentCountry: body.documentCountry?.toUpperCase() ?? null,
      documentType: body.documentType ?? null,
      subjectMatchResult: body.subjectMatchResult,
      relatedImageIds: body.relatedImageIds,
      notes: body.notes ?? null,
      verifiedAt: body.verifiedAt ? new Date(body.verifiedAt) : null,
    },
    update: {
      verifiedPersonId: body.verifiedPersonId ?? null,
      subjectUserId: body.subjectUserId ?? null,
      recordedById: input.recordedById ?? null,
      photoId: body.photoId ?? null,
      appearanceId: body.appearanceId ?? null,
      result: body.result,
      manualReviewStatus: body.manualReviewStatus,
      consentVersion: body.consentVersion ?? null,
      documentCountry: body.documentCountry?.toUpperCase() ?? null,
      documentType: body.documentType ?? null,
      subjectMatchResult: body.subjectMatchResult,
      relatedImageIds: body.relatedImageIds,
      notes: body.notes ?? null,
      verifiedAt: body.verifiedAt ? new Date(body.verifiedAt) : null,
    },
  })
  return serializeIdentityEvidence(row)
}

export async function listIdentityEvidence(filter: {
  subjectUserId?: string
  photoId?: string
}): Promise<IdentityVerificationEvidenceDto[]> {
  await assertIdentityVerificationEnabled()
  const rows = await prisma.identityVerificationEvidence.findMany({
    where: {
      ...(filter.subjectUserId ? { subjectUserId: filter.subjectUserId } : {}),
      ...(filter.photoId ? { photoId: filter.photoId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.map(serializeIdentityEvidence)
}

export async function getIdentityVerificationStatus() {
  const enabled = await isIdentityVerificationEnabled()
  return {
    enabled,
    providerConfigured: resolveIdentityProvider() !== null,
    biometricDatabase: false as const,
    retainsVerificationImagery: false as const,
    faceMatchEqualsConsent: false as const,
    message: enabled
      ? 'Identity verification flag is ON. Vendor calls still require a registered provider.'
      : 'Identity verification is OFF (Phase 60 default). Evidence API refuses writes until counsel activation.',
  }
}
