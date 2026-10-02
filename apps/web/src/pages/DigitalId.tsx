import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { DigitalIdPublicView } from '../components/marketplace/DigitalIdCard'
import { api, ApiError } from '../api/client'
import { publicQueryKeys } from '../lib/query-keys'

export default function DigitalIdPage() {
  const { token = '' } = useParams()
  const query = useQuery({
    queryKey: publicQueryKeys.digitalId(token),
    queryFn: () => api.digitalId(token),
    enabled: Boolean(token),
    retry: false,
  })

  if (query.isError || (!query.isLoading && !query.data)) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-terra">{missing ? '404' : 'Error'}</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Digital ID not found.</h1>
        <Link to="/creators" className="mt-8 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
          Browse creators
        </Link>
      </div>
    )
  }

  if (query.isLoading || !query.data) {
    return <p className="py-20 text-center text-sm text-ink-soft">Loading Digital ID…</p>
  }

  return (
    <div className="min-h-screen bg-paper px-5 py-12 text-ink md:px-8">
      <DigitalIdPublicView card={query.data} />
    </div>
  )
}
