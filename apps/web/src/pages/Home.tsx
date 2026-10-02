import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { DiscoveryHome } from './home/DiscoveryHome'
import { api } from '../api/client'
import { publicQueryKeys } from '../lib/query-keys'

/** Home content only — chrome comes from MarketplaceLayout (D-R2). */
export default function Home() {
  const { data: home = null } = useQuery({
    queryKey: publicQueryKeys.home,
    queryFn: () => api.home(),
  })

  return <DiscoveryHome home={home} />
}

/** Nested outlet helper if a future home child route needs the same shell. */
export function HomeOutlet() {
  return <Outlet />
}
