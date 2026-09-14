import * as Sentry from '@sentry/react'
import type { ErrorInfo } from 'react'
import { api } from '../api/client'

let ready = false

export async function initWebSentry() {
  try {
    const cfg = await api.publicConfig()
    if (!cfg.sentryDsn) return
    Sentry.init({
      dsn: cfg.sentryDsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0,
    })
    ready = true
  } catch {
    ready = false
  }
}

export function reportError(error: Error, info?: ErrorInfo) {
  if (!ready) return
  Sentry.captureException(error, {
    extra: { componentStack: info?.componentStack },
  })
}
