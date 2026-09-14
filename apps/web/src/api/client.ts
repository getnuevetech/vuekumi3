import type {
  AgreementDto,
  AuthUser,
  AgencyDto,
  AgencyInviteDto,
  AgencyInvitePreviewDto,
  AgencyMemberDto,
  LicenseGrantDto,
  LicenseProductDto,
  LicenseQuoteDto,
  PaginatedPhotos,
  PaymentDto,
  PaymentMethodsDto,
  PhotoDto,
  PurchaseLicenseResult,
  AiSuggestionDto,
  AiStatusDto,
  PublicConfigDto,
} from '@vuekumi/shared'
import type { AccountType, AgencyRole, LoginInput, OAuthDevInput, RegisterInput, SubmitPhotoInput } from '@vuekumi/shared'

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
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
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

  publicConfig: () => request<PublicConfigDto>('/api/public/config'),

  me: () => request<{ user: AuthUser }>('/api/auth/me'),

  oauthDev: (body: OAuthDevInput) =>
    request<{ user: AuthUser }>('/api/auth/oauth/dev', { method: 'POST', body: JSON.stringify(body) }),

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

  agreement: () => request<AgreementDto>('/api/agreements/current'),

  licenses: () => request<{ items: LicenseProductDto[] }>('/api/licenses'),

  photoLicenses: (id: string) => request<{ items: LicenseProductDto[] }>(`/api/photos/${id}/licenses`),

  purchaseLicense: (photoId: string, type: string, provider?: 'stripe' | 'flutterwave') =>
    request<PurchaseLicenseResult>(`/api/photos/${photoId}/licenses`, {
      method: 'POST',
      body: JSON.stringify({ type, provider }),
    }),

  requestQuote: (photoId: string, body: { territory: string; duration: string; channels: string; notes?: string }) =>
    request<{ quote: LicenseQuoteDto }>(`/api/photos/${photoId}/quotes`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  myGrants: () => request<{ items: LicenseGrantDto[] }>('/api/licenses/grants'),
  myQuotes: () => request<{ items: LicenseQuoteDto[] }>('/api/licenses/quotes'),
  acceptQuote: (id: string, provider?: 'stripe' | 'flutterwave') =>
    request<PurchaseLicenseResult>(`/api/licenses/quotes/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),

  agency: () =>
    request<{ agency: AgencyDto; recentGrants: LicenseGrantDto[]; recentQuotes: LicenseQuoteDto[] }>('/api/agency'),

  agencyMembers: () =>
    request<{ items: AgencyMemberDto[]; invites: AgencyInviteDto[]; seatLimit: number; seatsUsed: number }>(
      '/api/agency/members',
    ),

  inviteAgencyMember: (email: string, role: Exclude<AgencyRole, 'owner'>) =>
    request<{
      member?: AgencyMemberDto
      invite?: AgencyInviteDto
      joinUrl?: string
      immediate: boolean
    }>('/api/agency/members', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  updateAgencyMemberRole: (userId: string, role: Exclude<AgencyRole, 'owner'>) =>
    request<{ member: AgencyMemberDto }>(`/api/agency/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeAgencyMember: (userId: string) =>
    request<{ ok: boolean }>(`/api/agency/members/${userId}`, { method: 'DELETE' }),

  revokeAgencyInvite: (id: string) =>
    request<{ ok: boolean }>(`/api/agency/invites/${id}`, { method: 'DELETE' }),

  agencyInvitePreview: (token: string) =>
    request<{ invite: AgencyInvitePreviewDto }>(`/api/agency/join/${token}`),

  acceptAgencyInvite: (token: string, body?: { name?: string; password?: string; country?: string }) =>
    request<{ user: AuthUser; member: AgencyMemberDto }>(`/api/agency/join/${token}`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  paymentMethods: () => request<PaymentMethodsDto>('/api/payments/methods'),

  payment: (id: string) => request<{ payment: PaymentDto; grant: LicenseGrantDto | null }>(`/api/payments/${id}`),

  verifyPayment: (id: string) =>
    request<{ grant: LicenseGrantDto }>(`/api/payments/${id}/verify`, { method: 'POST', body: JSON.stringify({}) }),

  completeDevPayment: (id: string) =>
    request<{ grant: LicenseGrantDto }>(`/api/payments/${id}/complete-dev`, { method: 'POST', body: JSON.stringify({}) }),

  contributorEarnings: () =>
    request<{
      availableUsd: number
      thisMonthUsd: number
      allTimeUsd: number
      items: { id: string; photoTitle: string; amountUsd: number; source: string; createdAt: string }[]
    }>('/api/contributor/earnings'),

  async downloadCertificate(grantId: string) {
    const res = await fetch(`${API_BASE}/api/licenses/grants/${grantId}/certificate`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vuekumi-license-${grantId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },

  presignUpload: (filename: string, contentType: string) =>
    request<{
      driver: 's3' | 'local'
      key: string
      uploadUrl: string
      method: 'PUT'
      headers: Record<string, string>
    }>('/api/contributor/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType }),
    }),

  async putUpload(uploadUrl: string, file: File, headers: Record<string, string>) {
    const target = uploadUrl.startsWith('http') ? uploadUrl : `${API_BASE}${uploadUrl}`
    const res = await fetch(target, {
      method: 'PUT',
      headers,
      body: file,
      credentials: uploadUrl.startsWith('http') ? 'omit' : 'include',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? 'Upload failed', res.status)
    }
  },

  submitPhoto: (body: SubmitPhotoInput) =>
    request<{ photo: PhotoDto }>('/api/contributor/photos', { method: 'POST', body: JSON.stringify(body) }),

  updatePhoto: (id: string, body: Record<string, unknown>) =>
    request<{ photo: PhotoDto }>(`/api/contributor/photos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  aiStatus: () => request<AiStatusDto>('/api/ai/status'),

  suggestFile: (body: { imageBase64: string; mimeType: string; filename?: string; title?: string; country?: string; category?: string }) =>
    request<{ suggestion: AiSuggestionDto }>('/api/ai/suggest-file', { method: 'POST', body: JSON.stringify(body) }),

  suggestPhoto: (id: string) =>
    request<{ suggestion: AiSuggestionDto }>(`/api/photos/${id}/ai/suggest`, { method: 'POST', body: JSON.stringify({}) }),

  applySuggestion: (photoId: string, suggestionId: string, fields: string[]) =>
    request<{ photo: PhotoDto }>(`/api/photos/${photoId}/ai/suggestions/${suggestionId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    }),

  async downloadOriginal(photoId: string) {
    const res = await fetch(`${API_BASE}/api/media/${photoId}/original`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${photoId}-original.jpg`
    a.click()
    URL.revokeObjectURL(url)
  },

  async downloadGrantFile(grantId: string) {
    const res = await fetch(`${API_BASE}/api/licenses/grants/${grantId}/file`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vuekumi-${grantId}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  },

  contributorPhotos: () => request<{ items: PhotoDto[] }>('/api/contributor/photos'),

  adminContent: (params?: { q?: string; status?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    const q = qs.toString()
    return request<{ items: AdminContentRow[]; total: number }>(`/api/admin/content${q ? `?${q}` : ''}`)
  },

  adminContentDetail: (id: string) => request<AdminContentDetail>(`/api/admin/content/${id}`),

  patchRights: (id: string, body: Record<string, unknown>) =>
    request<{ photo: PhotoDto }>(`/api/admin/content/${id}/rights`, { method: 'PATCH', body: JSON.stringify(body) }),

  reviewModelRelease: (id: string, status: 'verified' | 'rejected', notes?: string) =>
    request<{ ok: boolean }>(`/api/admin/model-releases/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  adminModeration: () => request<{ items: AdminModerationRow[] }>('/api/admin/moderation'),

  decideModeration: (id: string, action: 'approve' | 'reject', notes?: string) =>
    request<{ ok: boolean }>(`/api/admin/moderation/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),

  adminQuotes: () => request<{ items: LicenseQuoteDto[] }>('/api/licenses/quotes'),

  priceQuote: (id: string, quoteUsd: number) =>
    request<{ quote: LicenseQuoteDto }>(`/api/admin/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quoteUsd, status: 'quoted' }),
    }),

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

export interface AdminContentRow extends PhotoDto {
  modelReleases?: { id: string; fileName: string; status: string; notes: string | null }[]
  grantsCount?: number
}

export interface AdminContentDetail {
  photo: PhotoDto
  modelReleases: { id: string; fileName: string; status: string; notes: string | null }[]
  grants: {
    id: string
    licenseType: string
    licenseName: string
    certificateCode: string
    buyerEmail: string
    amountUsd: number
    createdAt: string
  }[]
  quotes: LicenseQuoteDto[]
  moderation: { id: string; flag: string; status: string; notes: string | null }[]
}

export interface AdminModerationRow {
  id: string
  flag: string
  status: string
  submittedBy: string
  createdAt: string
  liveReady: boolean
  liveBlockers: string[]
  photo: PhotoDto
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

export function homeForUser(user: Pick<AuthUser, 'accountType' | 'agencyId'>): string {
  if (user.agencyId) return '/agency'
  return homeForAccountType(user.accountType)
}
