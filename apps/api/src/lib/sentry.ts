import * as Sentry from '@sentry/node'
import { config } from '../config.js'
import { getSettingSafe } from './settings.js'

let enabled = false

export function sentryReady(dsn: string | null | undefined): boolean {
  return Boolean(dsn && /^https?:\/\//.test(dsn))
}

export async function initSentry() {
  try {
    const dsn = await getSettingSafe('ops.sentry_dsn')
    if (!sentryReady(dsn)) return
    Sentry.init({
      dsn: dsn!,
      environment: config.nodeEnv,
      tracesSampleRate: 0,
    })
    enabled = true
  } catch {
    enabled = false
  }
}

export function captureException(err: unknown) {
  if (!enabled) return
  Sentry.captureException(err)
}
