import type { AuthUser, PaginatedPhotos, PhotoDto } from '@vuekumi/shared'
import type { AccountType, LoginInput, RegisterInput } from '@vuekumi/shared'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error ?? res.statusText, res.status)
  }
  return data as T
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  me: () => request<{ user: AuthUser }>('/api/auth/me'),

  login: (body: LoginInput) =>
    request<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  register: (body: RegisterInput) =>
    request<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ ok: boolean }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>(`/api/auth/reset-password/${token}`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  verifyEmail: (token: string) => request<{ ok: boolean }>(`/api/auth/verify-email/${token}`),

  photos: (params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString()
    return request<PaginatedPhotos>(`/api/photos${query ? `?${query}` : ''}`)
  },

  photo: (id: string) => request<PhotoDto>(`/api/photos/${id}`),

  sendPasswordReset: (userId: string) =>
    request<{ ok: boolean }>(`/api/auth/admin/send-password-reset/${userId}`, { method: 'POST' }),

  adminSettings: () =>
    request<{ settings: AdminSetting[] }>('/api/admin/settings'),

  updateAdminSettings: (settings: { key: string; value: string }[]) =>
    request<{ settings: AdminSetting[] }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),
}

export interface AdminSetting {
  key: string
  label: string
  group: string
  secret: boolean
  placeholder?: string
  configured: boolean
  value: string
  masked?: string
}

export function homeForAccountType(accountType: AccountType): string {
  switch (accountType) {
    case 'admin':
      return '/admin'
    case 'contributor':
      return '/contributor'
    case 'agency':
      return '/agency'
    default:
      return '/'
  }
}
