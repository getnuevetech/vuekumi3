/** Origin the buyer actually used. Falls back to WEB_URL when the host header is unusable. */
export function browserOrigin(
  request: {
    protocol?: string
    headers: {
      host?: string
      'x-forwarded-host'?: string | string[]
      'x-forwarded-proto'?: string | string[]
    }
  },
  fallback: string,
): string {
  const host = firstHeader(request.headers['x-forwarded-host']) || request.headers.host || ''
  const proto = (firstHeader(request.headers['x-forwarded-proto']) || request.protocol || '').split(',')[0].trim().toLowerCase()
  const cleanHost = host.split(',')[0].trim()
  if ((proto === 'http' || proto === 'https') && /^[A-Za-z0-9.-]+(?::\d+)?$/.test(cleanHost)) {
    return `${proto}://${cleanHost}`
  }
  return fallback.replace(/\/$/, '')
}

function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}
