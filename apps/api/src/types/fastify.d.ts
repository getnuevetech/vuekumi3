import type { AuthUser } from '@vuekumi/shared'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    authUser?: AuthUser
  }
}
