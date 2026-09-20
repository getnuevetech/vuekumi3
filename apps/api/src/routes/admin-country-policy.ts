import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  gateStatusSchema,
  policyEvaluateInputSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import {
  authorizeActivation,
  ensureCountryPolicyHold,
  evaluatePolicy,
  getCountryActivationDetail,
  listCountryActivationRegister,
  patchGate,
  seedHoldPoliciesForAllCountries,
  submitPolicyForReview,
  suspendPolicy,
} from '../lib/policy-decision.js'

const gatePatchSchema = z.object({
  status: gateStatusSchema.optional(),
  rationale: z.string().max(4000).nullable().optional(),
  evidence: z
    .object({
      label: z.string().min(1).max(200),
      url: z.string().url().optional(),
      notes: z.string().max(2000).optional(),
    })
    .optional(),
})

const notesSchema = z.object({
  notes: z.string().max(2000).optional(),
})

export async function adminCountryPolicyRoutes(app: FastifyInstance) {
  const research = { preHandler: requireAdminCapability(app, 'geo.activation.research') }
  const gateApprove = { preHandler: requireAdminCapability(app, 'geo.activation.gate.approve') }
  const submit = { preHandler: requireAdminCapability(app, 'geo.activation.submit') }
  const authorize = { preHandler: requireAdminCapability(app, 'geo.activation.authorize') }
  const suspendCap = { preHandler: requireAdminCapability(app, 'geo.activation.suspend') }
  const evaluate = { preHandler: requireAdminCapability(app, 'geo.activation.research') }

  app.get('/admin/countries/activation', research, async () => {
    const countries = await listCountryActivationRegister()
    return { countries }
  })

  app.post('/admin/countries/activation/seed-hold', research, async (request) => {
    const result = await seedHoldPoliciesForAllCountries(request.userId)
    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.country_policy.seed_hold',
      entityType: 'country_policy',
      metadata: result,
    })
    return { ok: true, ...result }
  })

  app.get('/admin/countries/:code/activation', research, async (request, reply) => {
    const { code } = request.params as { code: string }
    const detail = await getCountryActivationDetail(code)
    if (!detail) return reply.code(404).send({ error: 'Country not found' })
    const { country, policy } = detail
    return {
      country: {
        code: country.code,
        name: country.name,
        region: country.region,
        contributorEligible: country.contributorEligible,
        enabled: country.enabled,
        overlayKind: country.legalOverlay?.overlayKind ?? null,
        counselStatus: country.legalOverlay?.counselStatus ?? 'placeholder',
      },
      policy: serializePolicy(policy),
    }
  })

  app.post('/admin/countries/:code/activation/ensure', research, async (request, reply) => {
    const { code } = request.params as { code: string }
    try {
      const policy = await ensureCountryPolicyHold(code, request.userId)
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.country_policy.ensure_hold',
        entityType: 'country_policy',
        entityId: policy.id,
        metadata: { countryCode: code.toUpperCase() },
      })
      return { policy: serializePolicy(policy) }
    } catch (err) {
      const status = err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : 500
      return reply.code(status).send({ error: err instanceof Error ? err.message : 'Failed' })
    }
  })

  app.patch('/admin/countries/activation/gates/:gateId', gateApprove, async (request, reply) => {
    const { gateId } = request.params as { gateId: string }
    const body = gatePatchSchema.parse(request.body)
    try {
      const policy = await patchGate({
        gateId,
        actorId: request.userId!,
        status: body.status,
        rationale: body.rationale,
        evidence: body.evidence,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.country_policy.patch_gate',
        entityType: 'country_gate',
        entityId: gateId,
        metadata: { status: body.status },
      })
      return { policy: policy ? serializePolicy(policy) : null }
    } catch (err) {
      const status = err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : 500
      return reply.code(status).send({ error: err instanceof Error ? err.message : 'Failed' })
    }
  })

  app.post('/admin/countries/activation/:policyId/submit', submit, async (request, reply) => {
    const { policyId } = request.params as { policyId: string }
    const body = notesSchema.parse(request.body ?? {})
    try {
      const updated = await submitPolicyForReview(policyId, request.userId!, body.notes)
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.country_policy.submit_review',
        entityType: 'country_policy',
        entityId: policyId,
      })
      return { policyId: updated.id, status: updated.status }
    } catch (err) {
      const status = err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : 500
      return reply.code(status).send({ error: err instanceof Error ? err.message : 'Failed' })
    }
  })

  app.post('/admin/countries/activation/:policyId/activate', authorize, async (request, reply) => {
    const { policyId } = request.params as { policyId: string }
    const body = notesSchema.parse(request.body ?? {})
    try {
      const updated = await authorizeActivation({
        policyVersionId: policyId,
        authorizerId: request.userId!,
        notes: body.notes,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.country_policy.activate',
        entityType: 'country_policy',
        entityId: policyId,
        metadata: { countryCode: updated.countryCode, version: updated.version },
      })
      return { policyId: updated.id, status: updated.status, publishedAt: updated.publishedAt }
    } catch (err) {
      const status = err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : 500
      return reply.code(status).send({ error: err instanceof Error ? err.message : 'Failed' })
    }
  })

  app.post('/admin/countries/activation/:policyId/suspend', suspendCap, async (request, reply) => {
    const { policyId } = request.params as { policyId: string }
    const body = notesSchema.parse(request.body ?? {})
    try {
      const updated = await suspendPolicy({
        policyVersionId: policyId,
        actorId: request.userId!,
        notes: body.notes,
      })
      await writeAuditLog({
        actorId: request.userId,
        action: 'admin.country_policy.suspend',
        entityType: 'country_policy',
        entityId: policyId,
      })
      return { policyId: updated.id, status: updated.status }
    } catch (err) {
      const status = err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : 500
      return reply.code(status).send({ error: err instanceof Error ? err.message : 'Failed' })
    }
  })

  /** Staff PDS evaluate endpoint (eng-spec §5.1). */
  app.post('/policy/evaluate', evaluate, async (request) => {
    const body = policyEvaluateInputSchema.parse(request.body)
    return evaluatePolicy(body)
  })
}

function serializePolicy(policy: NonNullable<Awaited<ReturnType<typeof ensureCountryPolicyHold>>>) {
  return {
    id: policy.id,
    countryCode: policy.countryCode,
    version: policy.version,
    status: policy.status,
    preparedById: policy.preparedById,
    publishedAt: policy.publishedAt?.toISOString() ?? null,
    effectiveFrom: policy.effectiveFrom?.toISOString() ?? null,
    effectiveTo: policy.effectiveTo?.toISOString() ?? null,
    notes: policy.notes,
    gates: policy.gates.map((g) => ({
      id: g.id,
      code: g.code,
      title: g.title,
      status: g.status,
      rationale: g.rationale,
      evidence: g.evidence.map((e) => ({
        id: e.id,
        label: e.label,
        url: e.url,
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
      })),
      approvals: g.approvals.map((a) => ({
        id: a.id,
        approverId: a.approverId,
        decision: a.decision,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
    featureScopes: policy.featureScopes.map((s) => ({
      action: s.action,
      state: s.state,
      notes: s.notes,
    })),
    transitions: policy.transitions.map((t) => ({
      id: t.id,
      kind: t.kind,
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      actorId: t.actorId,
      authorizeId: t.authorizeId,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    })),
  }
}
