import {
  HOME_PRICING_KICKER,
  HOME_PRICING_TITLE,
  PLUS_PERIOD_DAYS,
  PLUS_PLAN,
  PLUS_PRICE_USD,
  STOCK_PERMISSION_STATES,
  featuredPinIneligibleReason,
  type BuyerPlanDto,
  type CreateBuyerPlanInput,
  type HomePricingCopy,
  type PatchBuyerPlanInput,
  type PatchHomePricingInput,
} from '@vuekumi/shared'
import type { BuyerPlan } from '@prisma/client'
import { prisma } from './prisma.js'

const PLUS_FEATURES = [
  'Unlimited royalty-free downloads from the free collection',
  'Premium images still billed per licence',
  'Cancel anytime — access lasts through the paid period',
]

export function serializeBuyerPlan(row: BuyerPlan, homePhotoSrc: string | null = null): BuyerPlanDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceUsd: row.priceUsd,
    periodDays: row.periodDays,
    description: row.description,
    features: row.features,
    badge: row.badge,
    highlighted: row.highlighted,
    homePhotoId: row.homePhotoId,
    homePhotoSrc,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    audience: (row.audience === 'photographer' || row.audience === 'contributor' || row.audience === 'model') ? row.audience : 'buyer',
  }
}

export function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'plan'
}

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number }
  err.statusCode = statusCode
  return err
}

export async function ensureDefaultPlusPlan() {
  return prisma.buyerPlan.upsert({
    where: { slug: PLUS_PLAN },
    update: {},
    create: {
      id: 'plan_vuekumi_plus',
      slug: PLUS_PLAN,
      name: 'Vuekumi+',
      priceUsd: PLUS_PRICE_USD,
      periodDays: PLUS_PERIOD_DAYS,
      description: 'Unlimited royalty-free downloads from the free collection for 30 days. Premium images stay billed per licence.',
      features: PLUS_FEATURES,
      badge: 'Most popular',
      highlighted: true,
      enabled: true,
      sortOrder: 0,
      audience: 'buyer',
    },
  })
}

export async function loadHomePricingCopy(): Promise<HomePricingCopy> {
  const row = await prisma.homeSectionConfig.findUnique({ where: { slot: 'pricing' } })
  return {
    kicker: row?.kicker?.trim() || HOME_PRICING_KICKER,
    title: row?.title?.trim() || HOME_PRICING_TITLE,
  }
}

export async function saveHomePricingCopy(input: PatchHomePricingInput): Promise<HomePricingCopy> {
  const row = await prisma.homeSectionConfig.upsert({
    where: { slot: 'pricing' },
    create: { slot: 'pricing', mode: 'pins', kicker: input.kicker, title: input.title },
    update: { kicker: input.kicker, title: input.title },
  })
  return {
    kicker: row.kicker?.trim() || HOME_PRICING_KICKER,
    title: row.title?.trim() || HOME_PRICING_TITLE,
  }
}

async function photoSrcById(ids: string[], liveOnly: boolean) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map<string, string>()
  const photos = await prisma.photo.findMany({
    where: {
      id: { in: unique },
      ...(liveOnly ? { status: 'active', permissionState: { in: [...STOCK_PERMISSION_STATES] } } : {}),
    },
    select: { id: true, src: true },
  })
  return new Map(photos.map((photo) => [photo.id, photo.src]))
}

export async function listBuyerPlans(opts: { includeDisabled: boolean; audience?: string }) {
  await ensureDefaultPlusPlan()
  const rows = await prisma.buyerPlan.findMany({
    where: {
      ...(opts.includeDisabled ? {} : { enabled: true }),
      ...(opts.audience ? { audience: opts.audience } : {}),
    },
    orderBy: [{ audience: 'asc' }, { sortOrder: 'asc' }, { priceUsd: 'asc' }, { name: 'asc' }],
  })
  const srcs = await photoSrcById(rows.map((row) => row.homePhotoId ?? ''), !opts.includeDisabled)
  return rows.map((row) => serializeBuyerPlan(row, row.homePhotoId ? srcs.get(row.homePhotoId) ?? null : null))
}

export async function defaultPlusOffer() {
  const row = await prisma.buyerPlan.findUnique({ where: { slug: PLUS_PLAN } })
  if (row) return { slug: row.slug, name: row.name, priceUsd: row.priceUsd, periodDays: row.periodDays }
  return { slug: PLUS_PLAN, name: 'Vuekumi+', priceUsd: PLUS_PRICE_USD, periodDays: PLUS_PERIOD_DAYS }
}

export async function resolveCheckoutPlan(slug: string) {
  const key = slug.trim().toLowerCase() || PLUS_PLAN
  const row = await prisma.buyerPlan.findUnique({ where: { slug: key } })
  if (row) {
    if (!row.enabled) throw httpError('That buyer plan is not available', 404)
    return row
  }
  if (key === PLUS_PLAN) {
    return {
      slug: PLUS_PLAN,
      name: 'Vuekumi+',
      priceUsd: PLUS_PRICE_USD,
      periodDays: PLUS_PERIOD_DAYS,
      description: null as string | null,
      audience: 'buyer',
    }
  }
  throw httpError('That buyer plan is not available', 404)
}

async function assertHomePhoto(photoId: string | null | undefined) {
  if (!photoId) return
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { status: true, permissionState: true },
  })
  if (!photo) throw httpError('Photograph not found')
  const reason = featuredPinIneligibleReason(photo)
  if (reason) throw httpError(reason)
}

export async function createBuyerPlan(input: CreateBuyerPlanInput) {
  const slug = (input.slug || slugFromName(input.name)).toLowerCase()
  if (slug === PLUS_PLAN) throw httpError('Vuekumi+ already exists. Edit that plan instead of creating another.', 409)
  await assertHomePhoto(input.homePhotoId)
  try {
    return await prisma.buyerPlan.create({
      data: {
        slug,
        name: input.name.trim(),
        priceUsd: input.priceUsd,
        periodDays: input.periodDays,
        description: input.description?.trim() || null,
        features: input.features ?? [],
        badge: input.badge?.trim() || null,
        highlighted: input.highlighted ?? false,
        homePhotoId: input.homePhotoId ?? null,
        enabled: input.enabled ?? true,
        sortOrder: input.sortOrder ?? 10,
        audience: input.audience ?? 'buyer',
      },
    })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      throw httpError('A plan with that slug already exists', 409)
    }
    throw err
  }
}

export async function updateBuyerPlan(id: string, input: PatchBuyerPlanInput) {
  const existing = await prisma.buyerPlan.findUnique({ where: { id } })
  if (!existing) throw httpError('Plan not found', 404)
  if (input.homePhotoId) await assertHomePhoto(input.homePhotoId)
  return prisma.buyerPlan.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.priceUsd !== undefined ? { priceUsd: input.priceUsd } : {}),
      ...(input.periodDays !== undefined ? { periodDays: input.periodDays } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.features !== undefined ? { features: input.features } : {}),
      ...(input.badge !== undefined ? { badge: input.badge?.trim() || null } : {}),
      ...(input.highlighted !== undefined ? { highlighted: input.highlighted } : {}),
      ...(input.homePhotoId !== undefined ? { homePhotoId: input.homePhotoId } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.audience !== undefined && existing.slug !== PLUS_PLAN ? { audience: input.audience } : {}),
    },
  })
}

function asDowngradeMode(value: string | null | undefined): 'prorate' | 'refund' | 'neither' {
  if (value === 'prorate' || value === 'refund' || value === 'neither') return value
  return 'neither'
}

export async function loadPlanPolicy() {
  const row = await prisma.planPolicy.findUnique({ where: { id: 'public' } })
  return { downgradeMode: asDowngradeMode(row?.downgradeMode) }
}

export async function savePlanPolicy(downgradeMode: 'prorate' | 'refund' | 'neither') {
  await prisma.planPolicy.upsert({
    where: { id: 'public' },
    create: { id: 'public', downgradeMode },
    update: { downgradeMode },
  })
  return { downgradeMode }
}

export async function deleteBuyerPlan(id: string) {
  const existing = await prisma.buyerPlan.findUnique({ where: { id } })
  if (!existing) throw httpError('Plan not found', 404)
  if (existing.slug === PLUS_PLAN) {
    throw httpError('Vuekumi+ is the default buyer plan. Disable it instead of deleting it.', 400)
  }
  await prisma.buyerPlan.delete({ where: { id } })
  return existing
}
