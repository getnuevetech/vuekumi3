import type { GrantLicenseType, LicenseGrant, LicenseProduct, Photo, Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { assertCanGrant, certificateCode } from './rights.js'
import { getContributorShare } from './payments-config.js'
import { appendRightsLedgerEvent } from './ledger.js'
import { isCommerciallyEligible, thirdPartyCopyright } from '@vuekumi/shared'

type Tx = Prisma.TransactionClient
export type GrantWithRelations = LicenseGrant & { photo: Photo; product: LicenseProduct }

export async function issueGrant(
  input: {
    buyerId: string
    photoId: string
    productId: string
    agencyId?: string | null
    quoteId?: string | null
    licenseType: GrantLicenseType
    amountUsd: number
    currency: string
    amountLocal: number
    scopeJson: Record<string, unknown>
    paymentId?: string
  },
  client: Tx | typeof prisma = prisma,
): Promise<GrantWithRelations> {
  const existing = await client.licenseGrant.findFirst({
    where: { buyerId: input.buyerId, photoId: input.photoId, licenseType: input.licenseType },
    include: { photo: true, product: true },
  })
  if (existing) return existing

  const photo = await client.photo.findUnique({
    where: { id: input.photoId },
    include: { rightsRecord: true, appearances: true, copyrightAuthorizations: true },
  })
  if (!photo) throw new Error('Photo not found')
  const product = await client.licenseProduct.findUnique({ where: { id: input.productId } })
  if (!product) throw new Error('Licence type not found')
  const copyrightCommercialScope = photo.copyrightAuthorizations.length > 0
    ? photo.copyrightAuthorizations.some((row) =>
      row.status === 'approved' && row.commercialSublicensing && row.quality === 'verified',
    )
    : undefined
  assertCanGrant(
    product,
    { ...photo, copyrightCommercialScope },
    photo.rightsRecord,
    photo.appearances,
  )

  const latestEvent = await client.rightsLedgerEvent.findFirst({
    where: { photoId: input.photoId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  const snapshot = {
    copyrightStatus: photo.rightsRecord?.copyrightStatus ?? 'claimed',
    modelConsentStatus: photo.rightsRecord?.modelConsentStatus ?? 'not_required',
    creationClaim: photo.creationClaim,
    thirdPartyCopyright: thirdPartyCopyright(photo.creationClaim),
    commercialEligible: isCommerciallyEligible({
      copyrightStatus: photo.rightsRecord?.copyrightStatus ?? 'claimed',
      modelConsentStatus: photo.rightsRecord?.modelConsentStatus ?? 'not_required',
      commercialLocked: photo.commercialLocked,
      creationClaim: photo.creationClaim,
      appearances: photo.appearances,
      copyrightCommercialScope,
    }),
    ledgerHeadId: latestEvent?.id ?? null,
  }

  const created = await client.licenseGrant.create({
    data: {
      buyerId: input.buyerId,
      photoId: input.photoId,
      productId: input.productId,
      agencyId: input.agencyId ?? undefined,
      quoteId: input.quoteId ?? undefined,
      licenseType: input.licenseType,
      amountUsd: input.amountUsd,
      currency: input.currency,
      amountLocal: input.amountLocal,
      scopeJson: input.scopeJson as Prisma.InputJsonValue,
      ledgerHeadId: latestEvent?.id ?? undefined,
      ledgerSnapshot: snapshot as Prisma.InputJsonValue,
      certificateCode: certificateCode(input.photoId, input.licenseType),
    },
    include: { photo: true, product: true },
  })

  await client.photo.update({
    where: { id: input.photoId },
    data: {
      downloads: { increment: 1 },
      ...(input.licenseType === 'exclusive'
        ? { exclusiveSold: true, status: 'delisted' as const }
        : {}),
    },
  })

  if (input.licenseType === 'exclusive') {
    await client.licenseQuote.updateMany({
      where: { photoId: input.photoId, status: { in: ['pending', 'quoted'] } },
      data: { status: 'declined' },
    })
  }

  if (input.quoteId) {
    await client.licenseQuote.update({
      where: { id: input.quoteId },
      data: { status: 'accepted' },
    })
  }

  if (input.amountUsd > 0) {
    const share = await getContributorShare()
    const amount = Math.round(input.amountUsd * share * 100) / 100
    await client.earningsLedger.create({
      data: {
        contributorId: photo.contributorId,
        photoId: input.photoId,
        paymentId: input.paymentId,
        grantId: created.id,
        source: 'licence_sale',
        amountUsd: amount,
        status: 'available',
      },
    })
    await client.contributorProfile.updateMany({
      where: { userId: photo.contributorId },
      data: { earnings: { increment: amount } },
    })
  }

  return created
}
