import {
  PLUS_PERIOD_DAYS,
  PLUS_PLAN,
  PLUS_PRICE_USD,
  type BuyerPlanDto,
  type CreateBuyerPlanInput,
  type PatchBuyerPlanInput,
} from '@vuekumi/shared'
import type { BuyerPlan } from '@prisma/client'
import { prisma } from './prisma.js'

export function serializeBuyerPlan(row: BuyerPlan): BuyerPlanDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceUsd: row.priceUsd,
    periodDays: row.periodDays,
    description: row.description,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
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
      enabled: true,
      sortOrder: 0,
    },
  })
}

export async function listBuyerPlans(opts: { includeDisabled: boolean }) {
  await ensureDefaultPlusPlan()
  return prisma.buyerPlan.findMany({
    where: opts.includeDisabled ? {} : { enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { priceUsd: 'asc' }, { name: 'asc' }],
  })
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
    }
  }
  throw httpError('That buyer plan is not available', 404)
}

export async function createBuyerPlan(input: CreateBuyerPlanInput) {
  const slug = (input.slug || slugFromName(input.name)).toLowerCase()
  if (slug === PLUS_PLAN) throw httpError('Vuekumi+ already exists. Edit that plan instead of creating another.', 409)
  try {
    return await prisma.buyerPlan.create({
      data: {
        slug,
        name: input.name.trim(),
        priceUsd: input.priceUsd,
        periodDays: input.periodDays,
        description: input.description?.trim() || null,
        enabled: input.enabled ?? true,
        sortOrder: input.sortOrder ?? 10,
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
  return prisma.buyerPlan.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.priceUsd !== undefined ? { priceUsd: input.priceUsd } : {}),
      ...(input.periodDays !== undefined ? { periodDays: input.periodDays } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  })
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
