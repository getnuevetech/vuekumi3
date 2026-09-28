import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_CATEGORY_BANNER_FRAME,
  DEFAULT_FEATURED_FRAME,
  DEFAULT_HOME_SECTION_ORDER,
  DEFAULT_PEOPLE_FRAME,
} from '@vuekumi/shared'
import { useSiteContent } from '../context/SiteContentContext'
import { api } from '../api/client'
import { publicQueryKeys } from '../lib/query-keys'
import { INFLUENCER_JOIN, SELL_HREF } from './home/utils'
import {
  BackToTop,
  CategoryBanners,
  CtaBand,
  EditorialSplit,
  FeaturedStrip,
  HeroSlider,
  IconRow,
  InfiniteFeed,
  Marquee,
  ModelsRail,
  NoirFooter,
  NoirHeader,
  NoirPricing,
  PeopleRail,
  StaticBannerSection,
  StatsBand,
} from './home/sections'

export default function Home() {
  const { content } = useSiteContent()
  const { data: home = null } = useQuery({
    queryKey: publicQueryKeys.home,
    queryFn: () => api.home(),
  })

  const stats = home?.stats ?? null
  const featured = home?.featured
  const layout = home?.layout
  const order = home?.layout ? home.layout.order : DEFAULT_HOME_SECTION_ORDER
  const bannerFrame = layout?.categoryBannerFrame ?? DEFAULT_CATEGORY_BANNER_FRAME

  const section = (key: string) => {
    switch (key) {
      case 'hero':
        return <HeroSlider photos={featured?.hero ?? []} stats={stats} />
      case 'marquee':
        return <Marquee categories={stats ? stats.categories.map((c) => c.value) : []} />
      case 'featured':
        return <FeaturedStrip photos={featured?.edge ?? []} frame={featured?.frame ?? DEFAULT_FEATURED_FRAME} />
      case 'icons':
        return <IconRow />
      case 'category_banners':
        return <CategoryBanners banners={featured?.categories ?? []} frame={bannerFrame} />
      case 'cta':
        return <CtaBand />
      case 'feed':
        return <InfiniteFeed />
      case 'editorial':
        return <EditorialSplit photos={featured?.editorial ?? []} stats={stats} />
      case 'stats':
        return <StatsBand categories={stats?.categories ?? []} background={featured?.statsBackground ?? null} />
      case 'photo_influencers':
        return (
          <PeopleRail
            copy={content.home.influencers}
            people={layout?.people.photo_influencers.people ?? []}
            frame={layout?.people.photo_influencers.frame ?? DEFAULT_PEOPLE_FRAME}
            joinTo={INFLUENCER_JOIN}
            browseTo="/creators?kind=photo_influencer"
            badge="Photo influencer"
          />
        )
      case 'photographers':
        return (
          <PeopleRail
            copy={content.home.photographers}
            people={layout?.people.photographers.people ?? []}
            frame={layout?.people.photographers.frame ?? DEFAULT_PEOPLE_FRAME}
            joinTo="/creators"
            browseTo="/creators?kind=photographer"
          />
        )
      case 'contributors':
        return (
          <PeopleRail
            copy={content.home.contributors}
            people={layout?.people.contributors.people ?? home?.contributors ?? []}
            frame={layout?.people.contributors.frame ?? DEFAULT_PEOPLE_FRAME}
            joinTo={SELL_HREF}
            browseTo="/creators"
          />
        )
      case 'models':
        return <ModelsRail />
      case 'pricing':
        return <NoirPricing photos={featured?.pricing ?? []} />
      default: {
        const banner = layout?.staticBanners.find((row) => `banner:${row.id}` === key)
        return banner ? <StaticBannerSection banner={banner} /> : null
      }
    }
  }

  return (
    <div className="min-h-screen bg-noir font-sans text-paper antialiased">
      <NoirHeader />
      {order.map((key) => <Fragment key={key}>{section(key)}</Fragment>)}
      <NoirFooter />
      <BackToTop />
    </div>
  )
}
