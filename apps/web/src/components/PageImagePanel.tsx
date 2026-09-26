import { useEffect, useState } from 'react'
import type { SitePanelPublic, SitePanelSlidePublic } from '@vuekumi/shared'

const FALLBACK_SRC = '/images/photos/fashion-portrait.jpg'

function SlideCaption({ slide }: { slide: SitePanelSlidePublic }) {
  const facts = [slide.title, slide.country, slide.contributorName].filter(Boolean)
  const line = facts.length ? facts.join(' · ') : slide.credit
  if (!slide.quote && !line) return null
  return (
    <div className="absolute bottom-10 left-10 right-10">
      {slide.quote && (
        <p className="font-serif-display text-3xl font-light leading-snug text-paper">
          <QuoteText text={slide.quote} />
        </p>
      )}
      {line && (
        <p className="mt-4 font-mono-tech text-[10px] uppercase tracking-[0.25em] text-paper-faint">
          {line}
        </p>
      )}
    </div>
  )
}

function QuoteText({ text }: { text: string }) {
  const match = text.match(/That['\u2019]s the point\./)
  if (!match || match.index == null) return text
  return (
    <>
      {text.slice(0, match.index)}
      <em className="text-terra">{text.slice(match.index)}</em>
    </>
  )
}

export function PageImagePanel({ panel }: { panel: SitePanelPublic }) {
  const live = panel.slides.filter((slide): slide is SitePanelSlidePublic & { src: string } => Boolean(slide.src))
  const slides = live.length
    ? live
    : [{
        src: FALLBACK_SRC,
        quote: panel.slides[0]?.quote ?? '',
        credit: panel.slides[0]?.credit ?? '',
        title: panel.slides[0]?.title ?? '',
        country: panel.slides[0]?.country ?? '',
        contributorName: panel.slides[0]?.contributorName ?? '',
      }]
  const signature = slides.map((slide) => slide.src).join('\n')
  const [index, setIndex] = useState(0)
  const safeIndex = index < slides.length ? index : 0
  const current = slides[safeIndex]!

  useEffect(() => {
    setIndex(0)
  }, [signature])

  useEffect(() => {
    if (slides.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % slides.length)
    }, panel.intervalSec * 1000)
    return () => window.clearInterval(timer)
  }, [signature, slides.length, panel.intervalSec])

  return (
    <div className="relative hidden min-h-screen overflow-hidden bg-ink-deep lg:block" data-slide-src={current.src}>
      {slides.map((slide, slideIndex) => (
        <img
          key={`${slide.src}-${slideIndex}`}
          src={slide.src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${slideIndex === safeIndex ? 'opacity-90' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/80 via-ink-deep/10 to-ink-deep/40" />
      <SlideCaption slide={current} />
    </div>
  )
}
