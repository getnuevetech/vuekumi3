import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL', 'postgresql://vuekumi:vuekumi@localhost:5432/vuekumi'),
  jwtSecret: required('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  cookieSecret: required('COOKIE_SECRET', 'dev-cookie-secret-change-in-production'),
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  accessTokenTtl: '15m',
  refreshTokenDays: 7,
  resetTokenHours: 1,
  verifyTokenHours: 48,
  isDev: (process.env.NODE_ENV ?? 'development') !== 'production',
  cookieSecure: (process.env.WEB_URL ?? '').startsWith('https://'),
}

const WEAK_SECRETS = new Set([
  'dev-jwt-secret-change-in-production',
  'dev-cookie-secret-change-in-production',
  'change-me-in-production',
  'generate-with-openssl-rand-base64-48',
])

export function assertProductionSecrets() {
  if (config.nodeEnv !== 'production') return
  if (WEAK_SECRETS.has(config.jwtSecret) || config.jwtSecret.length < 24) {
    throw new Error('JWT_SECRET must be a strong unique value in production')
  }
  if (WEAK_SECRETS.has(config.cookieSecret) || config.cookieSecret.length < 24) {
    throw new Error('COOKIE_SECRET must be a strong unique value in production')
  }
}
