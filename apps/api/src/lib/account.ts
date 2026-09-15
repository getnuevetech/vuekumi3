const RESERVED_HANDLES = new Set([
  'account',
  'admin',
  'agency',
  'api',
  'c',
  'collections',
  'contributor',
  'favorites',
  'following',
  'invite',
  'login',
  'm',
  'me',
  'model',
  'p',
  'photo',
  'pricing',
  'search',
  'settings',
  'vuekumi',
])

export function normalizeHandle(raw: string): { handle: string } | { error: string } {
  const handle = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (handle.length < 3 || handle.length > 40) {
    return { error: 'Handle must be 3–40 letters, numbers, or hyphens' }
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { error: 'That handle is reserved' }
  }
  return { handle }
}

export function passwordChangeBlocked(opts: {
  hasPassword: boolean
  currentPassword?: string
}): { status: number; error: string } | null {
  if (opts.hasPassword && !opts.currentPassword) {
    return { status: 400, error: 'Current password is required' }
  }
  return null
}

export function summarizeUserAgent(ua?: string | null): string {
  if (!ua?.trim()) return 'Unknown device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua) && !/Edg/.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua) && !/Chrome/.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  return os ? `${browser} on ${os}` : browser
}

export function isCurrentRefreshToken(cookie: string | undefined, tokenHash: string, hashFn: (raw: string) => string) {
  if (!cookie) return false
  return hashFn(cookie) === tokenHash
}
