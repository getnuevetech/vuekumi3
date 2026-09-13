import { prisma } from './prisma.js'

export async function writeAuditLog(input: {
  actorId?: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress,
    },
  })
}
