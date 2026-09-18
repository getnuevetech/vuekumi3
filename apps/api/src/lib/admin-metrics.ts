import type { AccountType } from '@prisma/client'
import type { AdminOverviewDto, AdminRevenuePointDto } from '@vuekumi/shared'
import { STOCK_PERMISSION_STATES } from '@vuekumi/shared'
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
  const [users, contributors, photosLive, pendingReview, openRightsReports, downloadAgg, payments, subscriptions, payouts] =
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
    },
    series,
  }
}
