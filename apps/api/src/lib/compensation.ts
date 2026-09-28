import type { Prisma, PrismaClient } from '@prisma/client'
import {
  COMPENSATION_PAYMENT_BASE,
  assertMultiModelPercentCap,
  compensationRequestedFromProposals,
  modelAllocationFromAgreement,
  negotiationTermsSatisfied,
  serializeCompensationProposal,
  termsRequestRevenue,
  type CompensationProposalDto,
  type CompensationTermsInput,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'

type Db = Prisma.TransactionClient | PrismaClient

export class CompensationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

function snapshotOf(row: {
  id: string
  status: string
  mode: string
  percent: number
  fixedUsd: number
  paymentBase: string
  notes: string | null
  parentId: string | null
}) {
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    percent: row.percent,
    fixedUsd: row.fixedUsd,
    paymentBase: row.paymentBase,
    notes: row.notes,
    parentId: row.parentId,
  }
}

async function appendEvent(
  client: Db,
  input: {
    proposalId: string
    actorId: string
    kind: string
    snapshot: Record<string, unknown>
  },
) {
  await client.compensationProposalEvent.create({
    data: {
      proposalId: input.proposalId,
      actorId: input.actorId,
      kind: input.kind,
      snapshot: input.snapshot as Prisma.InputJsonValue,
    },
  })
}

export async function listCompensationProposals(photoId: string, client: Db = prisma) {
  const rows = await client.compensationProposal.findMany({
    where: { photoId },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(serializeCompensationProposal)
}

export async function photoCompensationRequested(photoId: string, client: Db = prisma): Promise<boolean> {
  const rows = await client.compensationProposal.findMany({
    where: {
      photoId,
      status: { in: ['proposed', 'countered', 'accepted', 'activated'] },
    },
    select: { status: true, mode: true, percent: true, fixedUsd: true },
  })
  return compensationRequestedFromProposals(
    rows.map((row) => ({
      status: row.status,
      mode: row.mode,
      percent: row.percent,
      fixedUsd: row.fixedUsd,
    })) as CompensationProposalDto[],
  )
}

export async function assertNegotiationForCommercial(input: {
  photoId: string
  hasRecognizablePeople: boolean
  appearances: { id: string; status: string; consentStatus: string; selfShot: boolean }[]
}, client: Db = prisma): Promise<void> {
  if (!input.hasRecognizablePeople) return
  const required = input.appearances
    .filter((row) => row.status !== 'rejected' && row.status !== 'revoked')
    .filter((row) => row.consentStatus !== 'not_required')
    .map((row) => row.id)
  if (required.length === 0) return
  const proposals = await client.compensationProposal.findMany({
    where: { photoId: input.photoId },
    select: { appearanceId: true, status: true },
  })
  const gate = negotiationTermsSatisfied({
    hasRecognizablePeople: true,
    requiredAppearanceIds: required,
    proposals: proposals.map((p) => ({
      appearanceId: p.appearanceId,
      status: p.status as CompensationProposalDto['status'],
    })),
  })
  if (!gate.ok) {
    throw new CompensationError(gate.reason ?? 'Compensation agreement required', 403)
  }
}

async function loadAppearanceContext(appearanceId: string, client: Db) {
  const appearance = await client.photoAppearance.findUnique({
    where: { id: appearanceId },
    include: {
      photo: { include: { contributor: true } },
    },
  })
  if (!appearance) throw new CompensationError('Appearance not found', 404)
  return appearance
}

function actorRole(
  userId: string,
  appearance: { modelUserId: string | null; photo: { contributorId: string } },
): 'photographer' | 'model' | null {
  if (appearance.photo.contributorId === userId) return 'photographer'
  if (appearance.modelUserId && appearance.modelUserId === userId) return 'model'
  return null
}

export async function proposeCompensation(input: {
  appearanceId: string
  actorId: string
  terms: CompensationTermsInput
}, client: Db = prisma): Promise<CompensationProposalDto> {
  const appearance = await loadAppearanceContext(input.appearanceId, client)
  const role = actorRole(input.actorId, appearance)
  if (!role) throw new CompensationError('Only the photographer or depicted model can propose terms', 403)

  const open = await client.compensationProposal.findFirst({
    where: {
      appearanceId: appearance.id,
      status: { in: ['proposed', 'countered', 'accepted'] },
    },
  })
  if (open) {
    throw new CompensationError('An open proposal already exists for this appearance — counter, accept, or decline it')
  }

  const created = await client.compensationProposal.create({
    data: {
      photoId: appearance.photoId,
      appearanceId: appearance.id,
      proposedById: input.actorId,
      proposedAs: role,
      status: 'proposed',
      mode: input.terms.mode,
      percent: input.terms.mode === 'zero' ? 0 : input.terms.percent,
      fixedUsd: input.terms.mode === 'zero' ? 0 : input.terms.fixedUsd,
      paymentBase: COMPENSATION_PAYMENT_BASE,
      notes: input.terms.notes ?? null,
    },
  })
  await appendEvent(client, {
    proposalId: created.id,
    actorId: input.actorId,
    kind: 'proposed',
    snapshot: snapshotOf(created),
  })
  return serializeCompensationProposal(created)
}

export async function counterCompensation(input: {
  proposalId: string
  actorId: string
  terms: CompensationTermsInput
}, client: Db = prisma): Promise<CompensationProposalDto> {
  const current = await client.compensationProposal.findUnique({
    where: { id: input.proposalId },
    include: { appearance: { include: { photo: true } } },
  })
  if (!current) throw new CompensationError('Proposal not found', 404)
  if (!['proposed', 'countered'].includes(current.status)) {
    throw new CompensationError('Only open proposals can be countered')
  }
  const role = actorRole(input.actorId, current.appearance)
  if (!role) throw new CompensationError('Only the photographer or depicted model can counter', 403)
  if (current.proposedById === input.actorId && current.status === 'proposed') {
    throw new CompensationError('Wait for the other party to respond before countering your own proposal')
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.compensationProposal.update({
      where: { id: current.id },
      data: { status: 'superseded' },
    })
    const next = await tx.compensationProposal.create({
      data: {
        photoId: current.photoId,
        appearanceId: current.appearanceId,
        proposedById: input.actorId,
        proposedAs: role,
        status: 'countered',
        mode: input.terms.mode,
        percent: input.terms.mode === 'zero' ? 0 : input.terms.percent,
        fixedUsd: input.terms.mode === 'zero' ? 0 : input.terms.fixedUsd,
        paymentBase: COMPENSATION_PAYMENT_BASE,
        notes: input.terms.notes ?? null,
        parentId: current.id,
      },
    })
    await appendEvent(tx, {
      proposalId: next.id,
      actorId: input.actorId,
      kind: 'countered',
      snapshot: { ...snapshotOf(next), supersededId: current.id },
    })
    return next
  })
  return serializeCompensationProposal(created)
}

export async function acceptCompensation(input: {
  proposalId: string
  actorId: string
}, client: Db = prisma): Promise<CompensationProposalDto> {
  const current = await client.compensationProposal.findUnique({
    where: { id: input.proposalId },
    include: { appearance: { include: { photo: true } } },
  })
  if (!current) throw new CompensationError('Proposal not found', 404)
  if (!['proposed', 'countered'].includes(current.status)) {
    throw new CompensationError('Only open proposals can be accepted')
  }
  const role = actorRole(input.actorId, current.appearance)
  if (!role) throw new CompensationError('Only the photographer or depicted model can accept', 403)
  if (current.proposedById === input.actorId) {
    throw new CompensationError('The other party must accept these terms')
  }

  const updated = await client.compensationProposal.update({
    where: { id: current.id },
    data: { status: 'accepted', acceptedAt: new Date() },
  })
  await appendEvent(client, {
    proposalId: updated.id,
    actorId: input.actorId,
    kind: 'accepted',
    snapshot: snapshotOf(updated),
  })
  return serializeCompensationProposal(updated)
}

export async function declineCompensation(input: {
  proposalId: string
  actorId: string
}, client: Db = prisma): Promise<CompensationProposalDto> {
  const current = await client.compensationProposal.findUnique({
    where: { id: input.proposalId },
    include: { appearance: { include: { photo: true } } },
  })
  if (!current) throw new CompensationError('Proposal not found', 404)
  if (!['proposed', 'countered', 'accepted'].includes(current.status)) {
    throw new CompensationError('This proposal cannot be declined')
  }
  const role = actorRole(input.actorId, current.appearance)
  if (!role) throw new CompensationError('Only the photographer or depicted model can decline', 403)

  const updated = await client.compensationProposal.update({
    where: { id: current.id },
    data: { status: 'declined', declinedAt: new Date() },
  })
  await appendEvent(client, {
    proposalId: updated.id,
    actorId: input.actorId,
    kind: 'declined',
    snapshot: snapshotOf(updated),
  })
  return serializeCompensationProposal(updated)
}

export async function activateCompensation(input: {
  proposalId: string
  actorId: string
}, client: Db = prisma): Promise<CompensationProposalDto> {
  const current = await client.compensationProposal.findUnique({
    where: { id: input.proposalId },
    include: { appearance: { include: { photo: true } } },
  })
  if (!current) throw new CompensationError('Proposal not found', 404)
  if (current.status !== 'accepted') {
    throw new CompensationError('Only accepted proposals can be activated')
  }
  const role = actorRole(input.actorId, current.appearance)
  if (!role) throw new CompensationError('Only the photographer or depicted model can activate', 403)

  const others = await client.compensationProposal.findMany({
    where: {
      photoId: current.photoId,
      status: 'activated',
      NOT: { appearanceId: current.appearanceId },
    },
    select: { mode: true, percent: true },
  })
  const cap = assertMultiModelPercentCap([
    ...others.map((row) => ({ mode: row.mode as CompensationTermsInput['mode'], percent: row.percent })),
    { mode: current.mode as CompensationTermsInput['mode'], percent: current.percent },
  ])
  if (!cap.ok) throw new CompensationError(cap.reason)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.compensationProposal.updateMany({
      where: {
        appearanceId: current.appearanceId,
        status: 'activated',
        NOT: { id: current.id },
      },
      data: { status: 'superseded' },
    })
    const next = await tx.compensationProposal.update({
      where: { id: current.id },
      data: { status: 'activated', activatedAt: new Date() },
    })
    await appendEvent(tx, {
      proposalId: next.id,
      actorId: input.actorId,
      kind: 'activated',
      snapshot: snapshotOf(next),
    })
    return next
  })
  return serializeCompensationProposal(updated)
}

/**
 * P2-T6 — activated likeness agreements that can receive ledger lines.
 * Requires a claimed model account; zero-fee agreements allocate $0.
 */
export async function loadActivatedModelAgreements(photoId: string, client: Db = prisma) {
  return client.compensationProposal.findMany({
    where: {
      photoId,
      status: 'activated',
      appearance: { modelUserId: { not: null } },
    },
    include: {
      appearance: { select: { id: true, modelUserId: true, displayName: true } },
    },
    orderBy: { activatedAt: 'asc' },
  })
}

export type ModelLedgerLine = {
  appearanceId: string
  modelUserId: string
  proposalId: string
  amountUsd: number
  mode: string
  percent: number
  fixedUsd: number
}

/**
 * Split Contributor Distributable Share (creator pool) across activated model
 * agreements (Dec-PayBase). Photographer residual is what remains. Never reduces
 * platform share (Dec-Split). Caps total model pay at the pool.
 */
export function splitCreatorPoolForModels(
  creatorPoolUsd: number,
  agreements: Array<{
    id: string
    appearanceId: string
    mode: string
    percent: number
    fixedUsd: number
    appearance: { modelUserId: string | null }
  }>,
): { modelLines: ModelLedgerLine[]; photographerPoolUsd: number } {
  const pool = Math.max(0, creatorPoolUsd)
  const modelLines: ModelLedgerLine[] = []
  let allocated = 0
  for (const row of agreements) {
    const modelUserId = row.appearance.modelUserId
    if (!modelUserId) continue
    const raw = modelAllocationFromAgreement(pool, {
      mode: row.mode as CompensationTermsInput['mode'],
      percent: row.percent,
      fixedUsd: row.fixedUsd,
    })
    const remaining = Math.round((pool - allocated) * 100) / 100
    const amountUsd = Math.round(Math.min(remaining, Math.max(0, raw)) * 100) / 100
    if (amountUsd <= 0) continue
    modelLines.push({
      appearanceId: row.appearanceId,
      modelUserId,
      proposalId: row.id,
      amountUsd,
      mode: row.mode,
      percent: row.percent,
      fixedUsd: row.fixedUsd,
    })
    allocated = Math.round((allocated + amountUsd) * 100) / 100
  }
  return {
    modelLines,
    photographerPoolUsd: Math.round(Math.max(0, pool - allocated) * 100) / 100,
  }
}

export { termsRequestRevenue }
