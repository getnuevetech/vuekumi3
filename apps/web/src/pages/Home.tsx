import { useQuery } from '@tanstack/react-query'
import { SiteHeader, PublicFooter } from '../components/shared'
import { api } from '../api/client'
import { publicQueryKeys } from '../lib/query-keys'
import { DiscoveryHome } from './home/DiscoveryHome'

export default function Home() {
  const { data: home = null } = useQuery({
    queryKey: publicQueryKeys.home,
    queryFn: () => api.home(),
  })

  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      <SiteHeader />
      <DiscoveryHome home={home} />
      <PublicFooter />
    </div>
  )
}
