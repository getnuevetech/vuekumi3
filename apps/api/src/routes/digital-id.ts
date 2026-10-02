import type { FastifyInstance } from 'fastify'
import { getDigitalIdPublic } from '../lib/digital-id.js'

export async function digitalIdRoutes(app: FastifyInstance) {
  app.get('/digital-id/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const card = await getDigitalIdPublic(token)
    if (!card) return reply.code(404).send({ error: 'Digital ID not found' })
    // Explicit allow-list — never attach email, phone, documents, or ledger.
    return {
      token: card.token,
      cardType: card.cardType,
      status: card.status,
      issuedAt: card.issuedAt,
      displayName: card.displayName,
      handle: card.handle,
      roleLabel: card.roleLabel,
      location: card.location,
      publicId: card.publicId,
      profilePath: card.profilePath,
      avatarUrl: card.avatarUrl,
      badge: card.badge,
    }
  })
}
