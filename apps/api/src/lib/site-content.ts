import { mergeSiteContent, siteContentSchema, type SiteContent, type SitePublicDto } from '@vuekumi/shared'
import { MIN_PAYOUT_USD } from './payouts.js'
import { getContributorShare } from './payments-config.js'
import { advertisedPhotographerShare } from './share-formulas.js'
import { prisma } from './prisma.js'

const SITE_ID = 'public'

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number }
  err.statusCode = statusCode
  return err
}

async function resolveLogoUrl(ref: string | null): Promise<string | null> {
  if (!ref) return null
  if (ref.startsWith('/') || /^https?:\/\//i.test(ref)) return ref
  const photo = await prisma.photo.findUnique({
    where: { id: ref },
    select: { src: true, status: true },
  })
  if (!photo || photo.status !== 'active') return null
  return photo.src
}

async function facts() {
  const share = await advertisedPhotographerShare().catch(() => getContributorShare())
  return {
    photographerPct: Math.round(share * 100),
    payoutMinimumUsd: MIN_PAYOUT_USD,
  }
}

export async function loadSitePublic(): Promise<SitePublicDto> {
  const row = await prisma.siteContent.findUnique({ where: { id: SITE_ID } })
  const content = mergeSiteContent(row?.body ?? null)
  return {
    content,
    logoUrl: await resolveLogoUrl(content.brand.logoRef),
    facts: await facts(),
  }
}

export async function saveSiteContent(input: SiteContent): Promise<SitePublicDto> {
  const content = siteContentSchema.parse(input)
  if (content.brand.logoRef && !content.brand.logoRef.startsWith('/') && !/^https?:\/\//i.test(content.brand.logoRef)) {
    const photo = await prisma.photo.findUnique({
      where: { id: content.brand.logoRef },
      select: { id: true, status: true },
    })
    if (!photo || photo.status !== 'active') throw httpError('Logo photograph not found')
  }
  await prisma.siteContent.upsert({
    where: { id: SITE_ID },
    create: { id: SITE_ID, body: content },
    update: { body: content },
  })
  return {
    content,
    logoUrl: await resolveLogoUrl(content.brand.logoRef),
    facts: await facts(),
  }
}
