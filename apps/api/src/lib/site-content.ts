import { mergeSiteContent, normalizeSiteContent, siteContentSchema, STATIC_PANELS, type SiteContent, type SitePanelPublic, type SitePublicDto, type StaticPanelKey } from '@vuekumi/shared'
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

function isDirectImageRef(ref: string) {
  return ref.startsWith('/') || /^https?:\/\//i.test(ref)
}

async function resolveImageRef(ref: string | null): Promise<string | null> {
  if (!ref) return null
  if (isDirectImageRef(ref)) return ref
  const photo = await prisma.photo.findUnique({
    where: { id: ref },
    select: { src: true, status: true },
  })
  if (!photo || photo.status !== 'active') return null
  return photo.src
}

async function resolvePanels(content: SiteContent): Promise<Record<StaticPanelKey, SitePanelPublic>> {
  const panels = {} as Record<StaticPanelKey, SitePanelPublic>
  for (const panel of STATIC_PANELS) {
    const source = content.panels[panel.key]
    const slides = await Promise.all(source.slides.map(async (slide) => {
      if (isDirectImageRef(slide.imageRef)) {
        return {
          src: slide.imageRef,
          quote: slide.quote,
          credit: slide.credit,
          title: '',
          country: '',
          contributorName: '',
        }
      }
      const photo = await prisma.photo.findUnique({
        where: { id: slide.imageRef },
        select: { src: true, status: true, title: true, country: true, contributor: { select: { name: true } } },
      })
      if (!photo || photo.status !== 'active') {
        return { src: null, quote: slide.quote, credit: '', title: '', country: '', contributorName: '' }
      }
      return {
        src: photo.src,
        quote: slide.quote,
        credit: '',
        title: photo.title,
        country: photo.country,
        contributorName: photo.contributor.name,
      }
    }))
    panels[panel.key] = { intervalSec: source.intervalSec, slides }
  }
  return panels
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
    logoUrl: await resolveImageRef(content.brand.logoRef),
    panels: await resolvePanels(content),
    facts: await facts(),
  }
}

export async function saveSiteContent(input: SiteContent): Promise<SitePublicDto> {
  const content = normalizeSiteContent(siteContentSchema.parse(input))
  const refs = [
    content.brand.logoRef,
    ...STATIC_PANELS.flatMap((panel) => content.panels[panel.key].slides.map((slide) => slide.imageRef)),
  ].filter((ref): ref is string => typeof ref === 'string' && !isDirectImageRef(ref))
  if (refs.length) {
    const photos = await prisma.photo.findMany({
      where: { id: { in: [...new Set(refs)] }, status: 'active' },
      select: { id: true },
    })
    const live = new Set(photos.map((photo) => photo.id))
    if (content.brand.logoRef && !isDirectImageRef(content.brand.logoRef) && !live.has(content.brand.logoRef)) {
      throw httpError('Logo photograph not found')
    }
    for (const panel of STATIC_PANELS) {
      for (const slide of content.panels[panel.key].slides) {
        if (!isDirectImageRef(slide.imageRef) && !live.has(slide.imageRef)) {
          throw httpError(`Choose a live photograph for ${panel.label}.`)
        }
      }
    }
  }
  await prisma.siteContent.upsert({
    where: { id: SITE_ID },
    create: { id: SITE_ID, body: content },
    update: { body: content },
  })
  return {
    content,
    logoUrl: await resolveImageRef(content.brand.logoRef),
    panels: await resolvePanels(content),
    facts: await facts(),
  }
}
