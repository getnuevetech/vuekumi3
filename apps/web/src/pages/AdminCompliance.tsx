import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

type Readiness = {
  screening: {
    enabled: boolean
    providerConfigured: boolean
    countryOnlyReject: boolean
    inventsVendor: boolean
    message: string
  }
  identity: {
    enabled: boolean
    providerConfigured: boolean
    biometricDatabase: boolean
    faceMatchEqualsConsent: boolean
    message: string
  }
  matrix: { slotCount: number; namedProviderSlots: number; unnamedSlots: number }
  activationAllowed: boolean
  message: string
}

export function AdminCompliance() {
  const [ready, setReady] = useState<Readiness | null>(null)

  useEffect(() => {
    api.adminComplianceReadiness()
      .then(setReady)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load readiness'))
  }, [])

  return (
    <AdminShell subtitle="T9 screening + Phase 60 identity readiness. Flags stay OFF without counsel-approved providers.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Compliance</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Activation readiness.</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        {ready?.message
          ?? 'Checklist for KYC screening and identity verification. Do not invent vendors or enable production flags here.'}
      </p>

      {ready && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-sand-soft bg-white p-5 text-sm">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">T9 screening</p>
            <p className="mt-2 text-ink-soft">{ready.screening.message}</p>
            <p className="mt-3 font-mono-tech text-[10px] text-ink-faint">
              Flag: {ready.screening.enabled ? 'ON' : 'OFF'} · Provider: {ready.screening.providerConfigured ? 'yes' : 'no'} ·
              Country-only reject: {ready.screening.countryOnlyReject ? 'yes' : 'no'} · Invents vendor: {ready.screening.inventsVendor ? 'yes' : 'no'}
            </p>
          </div>
          <div className="rounded-2xl border border-sand-soft bg-white p-5 text-sm">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">Bio / Phase 60</p>
            <p className="mt-2 text-ink-soft">{ready.identity.message}</p>
            <p className="mt-3 font-mono-tech text-[10px] text-ink-faint">
              Flag: {ready.identity.enabled ? 'ON' : 'OFF'} · Provider: {ready.identity.providerConfigured ? 'yes' : 'no'} ·
              Biometric DB: {ready.identity.biometricDatabase ? 'yes' : 'no'} · Face≠consent: {ready.identity.faceMatchEqualsConsent ? 'false' : 'true'}
            </p>
          </div>
          <div className="rounded-2xl border border-sand-soft bg-white p-5 text-sm lg:col-span-2">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">Country matrix provider slots</p>
            <p className="mt-2 text-ink-soft">
              {ready.matrix.slotCount} slots · {ready.matrix.namedProviderSlots} named · {ready.matrix.unnamedSlots} unnamed.
              Slots may record evidence URLs while screening stays OFF.
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              Toggle flags only in{' '}
              <Link to="/admin/settings" className="text-terra">Admin Settings</Link>
              {' '}after counsel names partners. Activation allowed: {ready.activationAllowed ? 'yes' : 'no'}.
            </p>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
