import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { Redis } from 'ioredis'

export const AUTH_RATE_LIMIT = { max: 15, timeWindow: '1 minute' as const }
export const DOWNLOAD_RATE_LIMIT = { max: 40, timeWindow: '1 minute' as const }

const EXEMPT_PATHS = new Set(['/api/health', '/api/ready', '/api/public/config', '/api/public/home'])

export function rateLimitPath(url: string): string {
  return url.split('?')[0] ?? url
}

export function shouldSkipRateLimit(url: string): boolean {
  return EXEMPT_PATHS.has(rateLimitPath(url))
}

export function rateLimitErrorBody() {
  return {
    statusCode: 429,
    error: 'Too many requests',
  }
}

export async function connectRateLimitRedis(): Promise<Redis | undefined> {
  const url = process.env.REDIS_URL
  if (!url) return undefined
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 400,
    retryStrategy: () => null,
  })
  try {
    await redis.connect()
    await redis.ping()
    return redis
  } catch {
    redis.disconnect()
    return undefined
  }
}

export async function registerRateLimit(app: FastifyInstance) {
  const redis = await connectRateLimitRedis()
  if (redis) {
    app.addHook('onClose', async () => {
      redis.disconnect()
    })
  }

  await app.register(rateLimit, {
    global: true,
    max: 240,
    timeWindow: '1 minute',
    redis,
    skipOnError: true,
    allowList: (request: FastifyRequest) => shouldSkipRateLimit(request.url),
    errorResponseBuilder: () => rateLimitErrorBody(),
  })
}
