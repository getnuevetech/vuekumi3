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

  countries: (contributorsOnly?: boolean) =>
    request<{ countries: GeoCountry[] }>(`/api/geo/countries${contributorsOnly ? '?contributors=1' : ''}`),

  pricing: (country?: string) =>
    request<PricingQuote>(`/api/geo/pricing${country ? `?country=${country}` : ''}`),

  adminAccounts: (type: 'users' | 'contributors' | 'agencies' | 'admins', params?: { q?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page) qs.set('page', String(params.page))
    const q = qs.toString()
    return request<{ items: AdminAccount[]; total: number }>(`/api/admin/${type}${q ? `?${q}` : ''}`)
  },

  patchAccount: (id: string, body: Partial<AdminAccount>) =>
    request<{ user: AdminAccount }>(`/api/admin/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  adminCountries: () => request<{ countries: GeoCountry[] }>('/api/admin/countries'),
  upsertCountry: (body: Partial<GeoCountry> & { code: string; name: string; currency: string; currencyName: string; region: string }) =>
    request<{ country: GeoCountry }>('/api/admin/countries', { method: 'POST', body: JSON.stringify(body) }),
  patchCountry: (code: string, body: Partial<GeoCountry>) =>
    request<{ country: GeoCountry }>(`/api/admin/countries/${code}`, { method: 'PATCH', body: JSON.stringify(body) }),

  adminRates: () => request<{ rates: FxRate[] }>('/api/admin/exchange-rates'),
  syncRates: () => request<{ updated: number; currencies: string[] }>('/api/admin/exchange-rates/sync', { method: 'POST' }),
  overrideRate: (currency: string, overrideRate: number | null) =>
    request<{ rate: FxRate }>(`/api/admin/exchange-rates/${currency}`, {
      method: 'PATCH',
      body: JSON.stringify({ overrideRate }),
    }),

  adminGateways: () => request<{ gateways: PaymentGateway[] }>('/api/admin/gateways'),
  createGateway: (body: Record<string, unknown>) =>
    request<{ gateway: PaymentGateway }>('/api/admin/gateways', { method: 'POST', body: JSON.stringify(body) }),
  patchGateway: (id: string, body: Record<string, unknown>) =>
    request<{ gateway: PaymentGateway }>(`/api/admin/gateways/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteGateway: (id: string) => request<{ ok: boolean }>(`/api/admin/gateways/${id}`, { method: 'DELETE' }),

  adminAiProviders: () => request<{ providers: AiProvider[] }>('/api/admin/ai-providers'),
  createAiProvider: (body: Record<string, unknown>) =>
    request<{ provider: AiProvider }>('/api/admin/ai-providers', { method: 'POST', body: JSON.stringify(body) }),
  patchAiProvider: (id: string, body: Record<string, unknown>) =>
    request<{ provider: AiProvider }>(`/api/admin/ai-providers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAiProvider: (id: string) => request<{ ok: boolean }>(`/api/admin/ai-providers/${id}`, { method: 'DELETE' }),
}

export interface GeoCountry {
  code: string
  name: string
  currency: string
  currencyName: string
  region: string
  contributorEligible: boolean
  enabled: boolean
}

export interface PricingQuote {
  countryCode: string | null
  countryName: string | null
  currency: string
  currencyName: string
  rateToUsd: number
  source: 'auto' | 'override' | 'default'
  fetchedAt: string | null
}

export interface AdminAccount {
  id: string
  email: string
  name: string
  accountType: string
  status: string
  country: string | null
  joined: string
  emailVerified: boolean
  handle: string | null
  photos: number
  earnings: number
  downloads: number
  plan: string | null
  adminRole: string | null
  agencyName: string | null
  agencyStatus: string | null
}

export interface FxRate {
  currency: string
  rateToUsd: number
  overrideRate: number | null
  source: string
  fetchedAt: string | null
  effectiveRate: number
  effectiveSource: string
}

export interface PaymentGateway {
  id: string
  name: string
  slug: string
  kind: string
  countries: string[]
  currencies: string[]
  publicKey: string | null
  notes: string | null
  enabled: boolean
  hasSecret: boolean
  secretMasked?: string
}

export interface AiProvider {
  id: string
  name: string
  slug: string
  purpose: string
  apiBaseUrl: string | null
  notes: string | null
  enabled: boolean
  hasKey: boolean
  keyMasked?: string
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
