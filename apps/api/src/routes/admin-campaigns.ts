import type { FastifyInstance } from 'fastify'
import { campaignCloseBlocked } from '@vuekumi/shared'
import type { CampaignAdminDto, CampaignPitchDto } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'

const pitchInclude = {
  contributor: {
    select: {
      name: true,
      avatarUrl: true,
      contributorProfile: { select: { handle: true } },
    },
  },
  campaign: { select: { title: true } },
} as const

function serializeAdminCampaign(campaign: {
  id: string
  title: string
  brief: string
  deliverables: string | null
  usage: string | null
  location: string | null
  startDate: Date | null
  endDate: Date | null
  budgetUsd: number | null
  status: 'open' | 'closed'
  createdAt: Date
  owner: { name: string; email: string }
  _count: { pitches: number }
  pitches: { status: string }[]
}): CampaignAdminDto {
  return {
    id: campaign.id,
    title: campaign.title,
    brief: campaign.brief,
    deliverables: campaign.deliverables,
    usage: campaign.usage,
    location: campaign.location,
    startDate: campaign.startDate ? campaign.startDate.toISOString().slice(0, 10) : null,
    endDate: campaign.endDate ? campaign.endDate.toISOString().slice(0, 10) : null,
    budgetUsd: campaign.budgetUsd,
    status: campaign.status,
    ownerName: campaign.owner.name,
    ownerEmail: campaign.owner.email,
    pitchCount: campaign._count.pitches,
    pendingPitchCount: campaign.pitches.filter((p) => p.status === 'pending').length,
    createdAt: campaign.createdAt.toISOString(),
  }
}

function serializePitch(pitch: {
  id: string
  campaignId: string
  note: string
  rateUsd: number | null
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn'
  createdAt: Date
  respondedAt: Date | null
  contributor: {
    name: string
    avatarUrl: string | null
    contributorProfile: { handle: string } | null
  }
  campaign?: { title: string }
}, campaignTitle?: string): CampaignPitchDto {
  return {
    id: pitch.id,
    campaignId: pitch.campaignId,
    campaignTitle: pitch.campaign?.title ?? campaignTitle ?? '',
    contributorName: pitch.contributor.name,
    contributorHandle: pitch.contributor.contributorProfile?.handle ?? null,
    contributorAvatarUrl: pitch.contributor.avatarUrl,
    note: pitch.note,
    rateUsd: pitch.rateUsd,
    status: pitch.status,
    createdAt: pitch.createdAt.toISOString(),
    respondedAt: pitch.respondedAt ? pitch.respondedAt.toISOString() : null,
  }
}

/**
 * Phase 42 — staff campaign queue. Visibility + close for moderation.
 * No production commission and no payment rails. Accepting a pitch still
 * licenses nothing.
 */
export async function adminCampaignRoutes(app: FastifyInstance) {
  const list = { preHandler: requireAdminCapability(app, 'campaigns.list') }
  const close = { preHandler: requireAdminCapability(app, 'campaigns.close') }

  app.get('/admin/campaigns', list, async () => {
    const campaigns = await prisma.campaign.findMany({
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { pitches: true } },
        pitches: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return { items: campaigns.map(serializeAdminCampaign) }
  })

  app.get('/admin/campaigns/:id/pitches', list, async (request, reply) => {
    const { id } = request.params as { id: string }
    const campaign = await prisma.campaign.findUnique({ where: { id }, select: { title: true } })
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' })
    const pitches = await prisma.campaignPitch.findMany({
      where: { campaignId: id },
      include: pitchInclude,
      orderBy: { createdAt: 'asc' },
    })
    return { items: pitches.map((p) => serializePitch(p, campaign.title)) }
  })

  app.post('/admin/campaigns/:id/close', close, async (request, reply) => {
    const { id } = request.params as { id: string }
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { pitches: true } },
        pitches: { select: { status: true } },
      },
    })
    const blocked = campaignCloseBlocked({
      campaignFound: Boolean(campaign),
      campaignOpen: campaign?.status === 'open',
      isOwner: false,
      isAdmin: true,
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'closed' },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { pitches: true } },
        pitches: { select: { status: true } },
      },
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'campaign.close.admin',
      entityType: 'campaign',
      entityId: id,
      ipAddress: request.ip,
    })
    return { campaign: serializeAdminCampaign(updated) }
  })
}
