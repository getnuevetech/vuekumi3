import type { AccountType } from '@prisma/client'
import type { AdminOverviewDto, AdminRevenuePointDto } from '@vuekumi/shared'
import { STOCK_PERMISSION_STATES } from '@vuekumi/shared'
import { narrateCatalogEngagement, reportingProviderKind } from './analytics-report.js'
import { prisma } from './prisma.js'
import { roundUsd } from './payouts.js'

const LIVE = { status: 'active' as const, permissionState: { in: [...STOCK_PERMISSION_STATES] } }

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function currentMonthLabel(now = new Date()): string {
  return now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
}

export function emptyMonthBuckets(months = 6, now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push({
      key: monthKey(d),
      label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    })
  }
  return out
}

export function attributedAt(row: {
  paidAt?: Date | null
  processedAt?: Date | null
  periodStart?: Date | null
  createdAt: Date
}): Date {
  return row.paidAt ?? row.processedAt ?? row.periodStart ?? row.createdAt
}

export function revenuePayoutSeries(
  revenueRows: { amountUsd: number; at: Date }[],
  payoutRows: { amountUsd: number; at: Date }[],
  months = 6,
  now = new Date(),
): AdminRevenuePointDto[] {
  const buckets = emptyMonthBuckets(months, now)
  const revenue = new Map(buckets.map((b) => [b.key, 0]))
  const payouts = new Map(buckets.map((b) => [b.key, 0]))
  for (const row of revenueRows) {
    const key = monthKey(row.at)
    if (!revenue.has(key)) continue
    revenue.set(key, roundUsd((revenue.get(key) ?? 0) + row.amountUsd))
  }
  for (const row of payoutRows) {
    const key = monthKey(row.at)
    if (!payouts.has(key)) continue
    payouts.set(key, roundUsd((payouts.get(key) ?? 0) + row.amountUsd))
  }
  return buckets.map((b) => ({
    month: b.label,
    revenue: revenue.get(b.key) ?? 0,
    payouts: payouts.get(b.key) ?? 0,
  }))
}

export async function loadAdminOverview(now = new Date()): Promise<AdminOverviewDto> {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const [users, contributors, photosLive, pendingReview, openRightsReports, downloadAgg, payments, subscriptions, payouts, viewAgg, catalogFavorites, licencesIssued, moderationOlderThan7Days, categoryRows, provider] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { accountType: { in: ['photographer', 'photo_influencer', 'contributor'] satisfies AccountType[] } },
      }),
      prisma.photo.count({ where: LIVE }),
      prisma.moderationItem.count({ where: { status: 'pending' } }),
      prisma.rightsReport.count({ where: { status: { in: ['open', 'reviewing'] } } }),
      prisma.photo.aggregate({ where: LIVE, _sum: { downloads: true } }),
      prisma.payment.findMany({
        where: { status: 'paid' },
        select: { amountUsd: true, paidAt: true, createdAt: true },
      }),
      prisma.subscription.findMany({
        where: { status: { not: 'pending' } },
        select: { amountUsd: true, periodStart: true, createdAt: true },
      }),
      prisma.payout.findMany({
        where: { status: 'paid' },
        select: { amountUsd: true, processedAt: true, createdAt: true },
      }),
      prisma.photo.aggregate({ _sum: { views: true } }),
      prisma.photoFavorite.count(),
      prisma.licenseGrant.count(),
      prisma.moderationItem.count({ where: { status: 'pending', createdAt: { lt: weekAgo } } }),
      prisma.photo.groupBy({
        by: ['category'],
        where: LIVE,
        _sum: { views: true },
      }),
      reportingProviderKind(),
    ])

  const series = revenuePayoutSeries(
    [
      ...payments.map((row) => ({ amountUsd: row.amountUsd, at: attributedAt(row) })),
      ...subscriptions.map((row) => ({ amountUsd: row.amountUsd, at: attributedAt(row) })),
    ],
    payouts.map((row) => ({ amountUsd: row.amountUsd, at: attributedAt(row) })),
    6,
    now,
  )
  const current = series[series.length - 1]
  const catalogViews = viewAgg._sum.views ?? 0
  const busiest = [...categoryRows].sort((a, b) => (b._sum.views ?? 0) - (a._sum.views ?? 0))[0]
  const topCategory = (busiest?._sum.views ?? 0) > 0 ? busiest?.category ?? null : null
  const engagementReport = narrateCatalogEngagement({
    views: catalogViews,
    favorites: catalogFavorites,
    licences: licencesIssued,
    topCategory,
    moderationOlderThan7Days,
  })
  if (provider === 'openai') {
    engagementReport.push('A reporting provider is configured. Catalog rows are not sent to it.')
  }

  return {
    stats: {
      users,
      contributors,
      photosLive,
      pendingReview,
      openRightsReports,
      revenueMonthUsd: current?.revenue ?? 0,
      downloads: downloadAgg._sum.downloads ?? 0,
      monthLabel: currentMonthLabel(now),
      catalogViews,
      catalogFavorites,
      licencesIssued,
      moderationOlderThan7Days,
    },
    series,
    engagementReport,
  }
}
