import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  campaignCloseBlocked,
  campaignPitchBlocked,
  createCampaignSchema,
  createPitchSchema,
  pitchActionBlocked,
} from '@vuekumi/shared'
import type { CampaignDto, CampaignPitchDto } from '@vuekumi/shared'
import { config } from '../config.js'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate, requireAccountTypes } from '../lib/auth-middleware.js'
import { campaignPitchEmail, pitchDecisionEmail, sendEmail } from '../lib/email.js'
import { prisma } from '../lib/prisma.js'

type PitchRow = {
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
}

type CampaignRow = {
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
  ownerId: string
  createdAt: Date
  owner: { name: string }
  _count: { pitches: number }
}

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

function serializePitch(pitch: PitchRow, campaignTitle?: string): CampaignPitchDto {
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

function serializeCampaign(
  campaign: CampaignRow,
  viewerId: string,
  myPitch: PitchRow | null,
): CampaignDto {
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
    mine: campaign.ownerId === viewerId,
    pitchCount: campaign._count.pitches,
    myPitch: myPitch ? serializePitch(myPitch, campaign.title) : null,
    createdAt: campaign.createdAt.toISOString(),
  }
}

const campaignInclude = {
  owner: { select: { name: true } },
  _count: { select: { pitches: true } },
} as const

export async function campaignRoutes(app: FastifyInstance) {
  const auth = {
    preHandler: (request: FastifyRequest, reply: FastifyReply) => authenticate(app, request, reply),
  }
  const brand = { preHandler: requireAccountTypes(app, 'user', 'agency') }
  const contributor = { preHandler: requireAccountTypes(app, 'contributor') }

  app.post('/campaigns', brand, async (request) => {
    const body = createCampaignSchema.parse(request.body)
    const campaign = await prisma.campaign.create({
      data: {
        ownerId: request.userId!,
        title: body.title.trim(),
        brief: body.brief.trim(),
        deliverables: body.deliverables?.trim() || null,
        usage: body.usage?.trim() || null,
        location: body.location?.trim() || null,
        startDate: body.startDate ? new Date(`${body.startDate}T00:00:00.000Z`) : null,
        endDate: body.endDate ? new Date(`${body.endDate}T00:00:00.000Z`) : null,
        budgetUsd: body.budgetUsd ?? null,
      },
      include: campaignInclude,
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'campaign.create',
      entityType: 'campaign',
      entityId: campaign.id,
      ipAddress: request.ip,
    })

    return { campaign: serializeCampaign(campaign, request.userId!, null) }
  })

  app.get('/campaigns', auth, async (request) => {
    const mine = request.authUser!.accountType === 'user' || request.authUser!.accountType === 'agency'
    const where = mine
      ? { ownerId: request.userId! }
      : request.authUser!.accountType === 'admin'
        ? {}
        : { OR: [{ status: 'open' as const }, { pitches: { some: { contributorId: request.userId! } } }] }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        ...campaignInclude,
        pitches: { where: { contributorId: request.userId! }, include: pitchInclude },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return {
      items: campaigns.map((c) => serializeCampaign(c, request.userId!, c.pitches[0] ?? null)),
    }
  })

  app.get('/campaigns/:id/pitches', auth, async (request, reply) => {
    const { id } = request.params as { id: string }
    const campaign = await prisma.campaign.findUnique({ where: { id }, select: { ownerId: true, title: true } })
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' })
    if (campaign.ownerId !== request.userId && request.authUser!.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Only the campaign owner can see all pitches' })
    }
    const pitches = await prisma.campaignPitch.findMany({
      where: { campaignId: id },
      include: pitchInclude,
      orderBy: { createdAt: 'asc' },
    })
    return { items: pitches.map((p) => serializePitch(p, campaign.title)) }
  })

  app.post('/campaigns/:id/close', auth, async (request, reply) => {
    const { id } = request.params as { id: string }
    const campaign = await prisma.campaign.findUnique({ where: { id } })
    const blocked = campaignCloseBlocked({
      campaignFound: Boolean(campaign),
      campaignOpen: campaign?.status === 'open',
      isOwner: campaign?.ownerId === request.userId,
      isAdmin: request.authUser!.accountType === 'admin',
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'closed' },
      include: campaignInclude,
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'campaign.close',
      entityType: 'campaign',
      entityId: id,
      ipAddress: request.ip,
    })
    return { campaign: serializeCampaign(updated, request.userId!, null) }
  })

  app.post('/campaigns/:id/pitch', contributor, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createPitchSchema.parse(request.body)
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { owner: { select: { name: true, email: true } } },
    })
    const existing = campaign
      ? await prisma.campaignPitch.findUnique({
          where: { campaignId_contributorId: { campaignId: id, contributorId: request.userId! } },
        })
      : null

    const blocked = campaignPitchBlocked({
      campaignFound: Boolean(campaign),
      campaignOpen: campaign?.status === 'open',
      isOwner: campaign?.ownerId === request.userId,
      isContributor: true,
      alreadyPitched: Boolean(existing),
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const pitch = await prisma.campaignPitch.create({
      data: {
        campaignId: id,
        contributorId: request.userId!,
        note: body.note.trim(),
        rateUsd: body.rateUsd ?? null,
      },
      include: pitchInclude,
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'campaign.pitch',
      entityType: 'campaign_pitch',
      entityId: pitch.id,
      metadata: { campaignId: id },
      ipAddress: request.ip,
    })

    await sendEmail({
      to: campaign!.owner.email,
      subject: `New pitch: ${campaign!.title}`,
      html: campaignPitchEmail({
        name: campaign!.owner.name,
        contributorName: pitch.contributor.name,
        campaignTitle: campaign!.title,
        campaignsUrl: `${config.webUrl}/campaigns`,
      }),
    })

    return { pitch: serializePitch(pitch, campaign!.title) }
  })

  app.post('/campaigns/pitches/:id/:action', auth, async (request, reply) => {
    const { id, action } = request.params as { id: string; action: string }
    if (action !== 'accept' && action !== 'decline' && action !== 'withdraw') {
      return reply.code(404).send({ error: 'Unknown action' })
    }
    const pitch = await prisma.campaignPitch.findUnique({
      where: { id },
      include: {
        ...pitchInclude,
        campaign: { select: { title: true, ownerId: true, owner: { select: { name: true } } } },
        contributor: {
          select: {
            name: true,
            email: true,
            avatarUrl: true,
            contributorProfile: { select: { handle: true } },
          },
        },
      },
    })
    if (!pitch) return reply.code(404).send({ error: 'Pitch not found' })

    const blocked = pitchActionBlocked({
      action,
      status: pitch.status,
      isOwner: pitch.campaign.ownerId === request.userId,
      isContributor: pitch.contributorId === request.userId,
    })
    if (blocked) return reply.code(blocked.status).send({ error: blocked.error })

    const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'withdrawn'
    const updated = await prisma.campaignPitch.update({
      where: { id },
      data: { status, respondedAt: new Date() },
      include: pitchInclude,
    })

    await writeAuditLog({
      actorId: request.userId,
      action: `campaign.pitch_${action}`,
      entityType: 'campaign_pitch',
      entityId: id,
      ipAddress: request.ip,
    })

    if (action !== 'withdraw') {
      await sendEmail({
        to: pitch.contributor.email,
        subject: `Pitch ${status}: ${pitch.campaign.title}`,
        html: pitchDecisionEmail({
          name: pitch.contributor.name,
          ownerName: pitch.campaign.owner.name,
          campaignTitle: pitch.campaign.title,
          decision: status as 'accepted' | 'declined',
          campaignsUrl: `${config.webUrl}/campaigns`,
        }),
      })
    }

    return { pitch: serializePitch(updated, pitch.campaign.title) }
  })
}
