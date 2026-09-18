import type { FastifyInstance } from 'fastify'
import {
  createDmcaCounterNoticeSchema,
  createDmcaNoticeSchema,
  createRightsStrikeSchema,
  decideDmcaNoticeSchema,
  REPEAT_INFRINGER_POLICY,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { config } from '../config.js'
import {
  decideDmcaNotice,
  DmcaError,
  fileCounterNotice,
  fileDmcaNotice,
  recordRightsStrike,
  serializeDmcaNotice,
} from '../lib/dmca.js'
import { DEFAULT_OPS_ADDRESS, dmcaNoticeOpsEmail, sendEmail } from '../lib/email.js'
import { loadHoldSettings } from '../lib/holds.js'
import { prisma } from '../lib/prisma.js'
import { REPORT_RATE_LIMIT } from '../lib/rate-limit.js'
import { getSettingSafe } from '../lib/settings.js'

function dmcaError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof DmcaError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function dmcaRoutes(app: FastifyInstance) {
  const manage = { preHandler: requireAdminCapability(app, 'dmca.manage') }

  app.get('/dmca', async () => {
    const settings = await loadHoldSettings()
    return {
      agent: settings.agent,
      scope: 'copyright',
      policy: REPEAT_INFRINGER_POLICY,
      counterWaitDays: settings.counterWaitDays,
      repeatInfringerThreshold: settings.repeatInfringerThreshold,
      copyrightOfficeNote:
        'The designated agent identity below is shown for notices. Registering that agent with the U.S. Copyright Office is an operations and counsel task. This page does not file that registration.',
    }
  })

  app.post('/dmca/notices', {
    config: { rateLimit: REPORT_RATE_LIMIT },
  }, async (request, reply) => {
    const body = createDmcaNoticeSchema.parse(request.body)
    try {
      const notice = await fileDmcaNotice({
        ...body,
        ip: request.ip,
        userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'].slice(0, 400) : null,
      })
      const ops = (await getSettingSafe('email.ops_address'))?.trim() || DEFAULT_OPS_ADDRESS
      await sendEmail({
        to: ops,
        subject: `DMCA notice: ${notice.photoTitle ?? notice.id}`,
        html: dmcaNoticeOpsEmail({
          photoTitle: notice.photoTitle ?? notice.infringingLocation,
          claimantEmail: notice.claimantEmail,
          queueUrl: `${config.webUrl}/admin/dmca`,
        }),
      })
      await writeAuditLog({
        action: 'dmca.notice',
        entityType: 'dmca_notice',
        entityId: notice.id,
        metadata: { photoId: notice.photoId },
        ipAddress: request.ip,
      })
      return { notice }
    } catch (err) {
      return dmcaError(reply, err)
    }
  })

  app.get('/dmca/notices/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const notice = await prisma.dmcaNotice.findUnique({
      where: { id },
      include: {
        photo: { include: { contributor: { include: { contributorProfile: true } } } },
        counter: true,
      },
    })
    if (!notice) return reply.code(404).send({ error: 'Notice not found' })
    return { notice: serializeDmcaNotice(notice) }
  })

  app.post('/dmca/notices/:id/counter', {
    config: { rateLimit: REPORT_RATE_LIMIT },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createDmcaCounterNoticeSchema.parse(request.body)
    try {
      const notice = await fileCounterNotice({
        noticeId: id,
        ...body,
        ip: request.ip,
      })
      const ops = (await getSettingSafe('email.ops_address'))?.trim() || DEFAULT_OPS_ADDRESS
      await sendEmail({
        to: ops,
        subject: `DMCA counter-notice: ${notice.photoTitle ?? notice.id}`,
        html: dmcaNoticeOpsEmail({
          photoTitle: notice.photoTitle ?? notice.infringingLocation,
          claimantEmail: notice.claimantEmail,
          queueUrl: `${config.webUrl}/admin/dmca`,
        }),
      })
      return { notice }
    } catch (err) {
      return dmcaError(reply, err)
    }
  })

  app.get('/admin/dmca', manage, async (request) => {
    const query = request.query as { status?: string }
    const status = query.status && query.status !== 'all' ? query.status : undefined
    const items = await prisma.dmcaNotice.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        photo: { include: { contributor: { include: { contributorProfile: true } } } },
        counter: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return { items: items.map(serializeDmcaNotice) }
  })

  app.post('/admin/dmca/:id/decide', manage, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = decideDmcaNoticeSchema.parse(request.body ?? {})
    try {
      const notice = await decideDmcaNotice({
        noticeId: id,
        action: body.action,
        notes: body.notes,
        actorId: request.userId!,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: `dmca.${body.action}`,
        entityType: 'dmca_notice',
        entityId: id,
        metadata: { notes: body.notes ?? null },
        ipAddress: request.ip,
      })
      return { notice }
    } catch (err) {
      return dmcaError(reply, err)
    }
  })

  app.get('/admin/strikes', manage, async (request) => {
    const query = request.query as { userId?: string }
    const items = await prisma.rightsStrike.findMany({
      where: query.userId ? { userId: query.userId } : undefined,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return {
      items: items.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.user.name,
        userEmail: row.user.email,
        reason: row.reason,
        photoId: row.photoId,
        noticeId: row.noticeId,
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
        strikeCount: row.user.rightsStrikeCount,
        terminated: Boolean(row.user.repeatInfringerAt),
      })),
    }
  })

  app.post('/admin/strikes', manage, async (request, reply) => {
    const body = createRightsStrikeSchema.parse(request.body)
    try {
      const strike = await recordRightsStrike({
        ...body,
        actorId: request.userId!,
      })
      return { strike }
    } catch (err) {
      return dmcaError(reply, err)
    }
  })
}
