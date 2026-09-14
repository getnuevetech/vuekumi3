import type { PayoutKind, PayoutMethodDto, PayoutStatus } from '@vuekumi/shared'
import { prisma } from './prisma.js'

export const MIN_PAYOUT_USD = 10

export class PayoutError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'PayoutError'
    this.statusCode = statusCode
  }
}

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100
}

export function maskAccountRef(ref: string): string {
  const trimmed = ref.replace(/\s+/g, '')
  if (trimmed.length <= 4) return '••••'
  return `••••${trimmed.slice(-4)}`
}

export function methodDisplay(kind: string, label: string): string {
  const prefix = kind === 'mobile_money' ? 'Mobile money' : 'Bank transfer'
  return `${prefix} (${label})`
}

export function canRequestPayout(input: {
  availableUsd: number
  minUsd: number
  pendingCount: number
  hasMethod: boolean
}): string | null {
  if (!input.hasMethod) return 'Add a payout method first'
  if (input.pendingCount > 0) return 'A payout is already in progress'
  if (roundUsd(input.availableUsd) < input.minUsd) {
    return `Minimum payout is $${input.minUsd.toFixed(2)}`
  }
  return null
}

export function earningsMonthSeries(
  rows: { createdAt: Date; amountUsd: number }[],
  months = 6,
): { month: string; earnings: number }[] {
  const now = new Date()
  const buckets = new Map<string, number>()
  const labels: string[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    buckets.set(key, 0)
    labels.push(label)
  }
  for (const row of rows) {
    const key = `${row.createdAt.getUTCFullYear()}-${String(row.createdAt.getUTCMonth() + 1).padStart(2, '0')}`
    if (!buckets.has(key)) continue
    buckets.set(key, roundUsd((buckets.get(key) ?? 0) + row.amountUsd))
  }
  return [...buckets.values()].map((earnings, i) => ({ month: labels[i]!, earnings }))
}

export function serializePayoutMethod(row: {
  id: string
  kind: string
  label: string
  accountName: string
  accountRef: string
  bankName: string | null
  country: string | null
  isDefault: boolean
}): PayoutMethodDto {
  return {
    id: row.id,
    kind: row.kind as PayoutKind,
    label: row.label,
    accountName: row.accountName,
    accountRefMasked: maskAccountRef(row.accountRef),
    bankName: row.bankName,
    country: row.country,
    isDefault: row.isDefault,
  }
}

export function serializePayout(row: {
  id: string
  amountUsd: number
  status: string
  notes: string | null
  requestedAt: Date
  processedAt: Date | null
  method: { kind: string; label: string; accountRef: string }
  contributor: { name: string; contributorProfile: { handle: string } | null }
}) {
  return {
    id: row.id,
    amountUsd: row.amountUsd,
    status: row.status as PayoutStatus,
    methodLabel: methodDisplay(row.method.kind, row.method.label),
    methodKind: row.method.kind as PayoutKind,
    accountRefMasked: maskAccountRef(row.method.accountRef),
    contributorHandle: row.contributor.contributorProfile?.handle ?? null,
    contributorName: row.contributor.name,
    notes: row.notes,
    requestedAt: row.requestedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  }
}

const payoutInclude = {
  method: true,
  contributor: { include: { contributorProfile: true } },
} as const

export async function requestPayout(input: {
  contributorId: string
  methodId?: string
}) {
  const [available, pendingCount, methods] = await Promise.all([
    prisma.earningsLedger.aggregate({
      where: { contributorId: input.contributorId, status: 'available' },
      _sum: { amountUsd: true },
    }),
    prisma.payout.count({
      where: { contributorId: input.contributorId, status: 'requested' },
    }),
    prisma.payoutMethod.findMany({
      where: { userId: input.contributorId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
  ])

  const method = input.methodId
    ? methods.find((m) => m.id === input.methodId)
    : methods.find((m) => m.isDefault) ?? methods[0]

  const blocked = canRequestPayout({
    availableUsd: available._sum.amountUsd ?? 0,
    minUsd: MIN_PAYOUT_USD,
    pendingCount,
    hasMethod: Boolean(method),
  })
  if (blocked) throw new PayoutError(blocked)
  if (!method) throw new PayoutError('Add a payout method first')

  const rows = await prisma.earningsLedger.findMany({
    where: { contributorId: input.contributorId, status: 'available' },
    orderBy: { createdAt: 'asc' },
  })
  const amountUsd = roundUsd(rows.reduce((sum, row) => sum + row.amountUsd, 0))
  if (amountUsd < MIN_PAYOUT_USD) {
    throw new PayoutError(`Minimum payout is $${MIN_PAYOUT_USD.toFixed(2)}`)
  }

  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.create({
      data: {
        contributorId: input.contributorId,
        payoutMethodId: method.id,
        amountUsd,
        status: 'requested',
        provider: 'manual',
      },
    })
    await tx.earningsLedger.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: 'reserved', payoutId: payout.id },
    })
    return tx.payout.findUniqueOrThrow({
      where: { id: payout.id },
      include: payoutInclude,
    })
  })
}

export async function markPayoutPaid(input: {
  payoutId: string
  actorId: string
  notes?: string
}) {
  const payout = await prisma.payout.findUnique({ where: { id: input.payoutId } })
  if (!payout) throw new PayoutError('Payout not found', 404)
  if (payout.status !== 'requested') throw new PayoutError('This payout is no longer pending')

  return prisma.$transaction(async (tx) => {
    await tx.earningsLedger.updateMany({
      where: { payoutId: payout.id, status: 'reserved' },
      data: { status: 'paid' },
    })
    return tx.payout.update({
      where: { id: payout.id },
      data: {
        status: 'paid',
        processedAt: new Date(),
        processedById: input.actorId,
        notes: input.notes?.trim() || payout.notes,
        providerRef: payout.providerRef ?? `manual-${payout.id.slice(-8)}`,
      },
      include: payoutInclude,
    })
  })
}

export async function rejectPayout(input: {
  payoutId: string
  actorId: string
  notes?: string
}) {
  const payout = await prisma.payout.findUnique({ where: { id: input.payoutId } })
  if (!payout) throw new PayoutError('Payout not found', 404)
  if (payout.status !== 'requested') throw new PayoutError('This payout is no longer pending')

  return prisma.$transaction(async (tx) => {
    await tx.earningsLedger.updateMany({
      where: { payoutId: payout.id, status: 'reserved' },
      data: { status: 'available', payoutId: null },
    })
    return tx.payout.update({
      where: { id: payout.id },
      data: {
        status: 'rejected',
        processedAt: new Date(),
        processedById: input.actorId,
        notes: input.notes?.trim() || 'Rejected',
      },
      include: payoutInclude,
    })
  })
}

export async function upsertDefaultMethod(userId: string, methodId: string) {
  await prisma.$transaction([
    prisma.payoutMethod.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.payoutMethod.update({ where: { id: methodId }, data: { isDefault: true } }),
  ])
}
