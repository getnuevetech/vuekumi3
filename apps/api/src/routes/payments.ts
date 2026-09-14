import type { FastifyInstance } from 'fastify'
import { authenticate } from '../lib/auth-middleware.js'
import { listCheckoutMethods } from '../lib/payments-config.js'
import {
  completeDevPayment,
  handleFlutterwaveWebhook,
  handleStripeWebhook,
  PaymentError,
  verifyAndFulfill,
} from '../lib/payments.js'
import { prisma } from '../lib/prisma.js'
import { serializeGrant, serializePayment } from '../lib/serialize.js'

function payError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof PaymentError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function paymentRoutes(app: FastifyInstance) {
  app.get('/payments/methods', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    return listCheckoutMethods(request.authUser?.country)
  })

  app.get('/payments/:id', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { grant: { include: { photo: true, product: true } } },
    })
    if (!payment) return reply.code(404).send({ error: 'Payment not found' })
    if (payment.buyerId !== request.userId && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    return {
      payment: serializePayment(payment),
      grant: payment.grant ? serializeGrant(payment.grant) : null,
    }
  })

  app.post('/payments/:id/verify', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const payment = await prisma.payment.findUnique({ where: { id } })
    if (!payment) return reply.code(404).send({ error: 'Payment not found' })
    if (payment.buyerId !== request.userId && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    try {
      const grant = await verifyAndFulfill(id)
      return { grant: serializeGrant(grant) }
    } catch (err) {
      return payError(reply, err)
    }
  })

  app.post('/payments/:id/complete-dev', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const payment = await prisma.payment.findUnique({ where: { id } })
    if (!payment) return reply.code(404).send({ error: 'Payment not found' })
    if (payment.buyerId !== request.userId && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    try {
      const grant = await completeDevPayment(id)
      return { grant: serializeGrant(grant) }
    } catch (err) {
      return payError(reply, err)
    }
  })

  await app.register(async (scope) => {
    scope.removeContentTypeParser('application/json')
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body)
    })
    scope.post('/webhooks/stripe', async (request, reply) => {
      try {
        const sig = request.headers['stripe-signature']
        const result = await handleStripeWebhook(
          request.body as Buffer,
          Array.isArray(sig) ? sig[0] : sig,
        )
        return result
      } catch (err) {
        request.log.warn({ err }, 'stripe webhook failed')
        return payError(reply, err)
      }
    })
  })

  app.post('/webhooks/flutterwave', async (request, reply) => {
    try {
      const hash = request.headers['verif-hash']
      const result = await handleFlutterwaveWebhook(
        (request.body ?? {}) as Record<string, unknown>,
        Array.isArray(hash) ? hash[0] : hash,
      )
      return result
    } catch (err) {
      return payError(reply, err)
    }
  })
}
