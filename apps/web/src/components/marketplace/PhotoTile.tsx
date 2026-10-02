import { Link } from 'react-router'
import { LIBRARY_TIER_LABEL, type PhotoDto } from '@vuekumi/shared'
import { CountryMark, PhotoHoverActions } from '../PhotoActions'

export type PhotoDensity = 'comfortable' | 'compact'

type TilePhoto = Pick<
  PhotoDto,
  'id' | 'src' | 'title' | 'country' | 'license' | 'price' | 'photographer' | 'photographerName' | 'libraryTier' | 'favorited'
> & {
  appearances?: PhotoDto['appearances']
}

export function PhotoTile({
  photo,
  density = 'comfortable',
  modelCredits = false,
}: {
  photo: TilePhoto
  density?: PhotoDensity
  modelCredits?: boolean
}) {
  const name = photo.photographerName ?? photo.photographer
  const tier = photo.libraryTier
  const tierLabel = tier ? LIBRARY_TIER_LABEL[tier] : photo.license === 'premium' ? 'Premium' : 'Free Library'
  const credit = modelCredits
    ? photo.appearances?.find((item) => item.status === 'approved' && item.displayName)
    : null
  const minHeight = density === 'compact' ? 'min-h-40' : 'min-h-52'

  return (
    <Link to={`/photo/${photo.id}`} className="group relative mb-4 block break-inside-avoid overflow-hidden rounded-2xl bg-cream">
      <img
        src={photo.src}
        alt={photo.title}
        loading="lazy"
        className={`${minHeight} w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]`}
      />
      <CountryMark country={photo.country} />
      <PhotoHoverActions
        photo={{
          id: photo.id,
          src: photo.src,
          title: photo.title,
          country: photo.country,
          license: photo.license,
          price: photo.price,
          favorited: photo.favorited,
        }}
      />
      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink">
        {tierLabel}
      </span>
      <div data-on-photo className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/85 to-transparent p-3 pt-16">
        {credit?.modelAvatarUrl ? (
          <img src={credit.modelAvatarUrl} alt="" className="mb-2 h-10 w-10 rounded-full object-cover ring-1 ring-white/80" />
        ) : credit ? (
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-noir/70 font-condensed text-sm uppercase text-paper ring-1 ring-white/70">
            {credit.displayName.slice(0, 1)}
          </span>
        ) : null}
        <p className="font-condensed text-sm uppercase tracking-[0.12em] text-paper">{photo.title}</p>
        <p className="mt-0.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-paper-soft">
          {credit
            ? `${credit.modelHandle ? `@${credit.modelHandle} · ` : ''}${credit.displayName}`
            : name}
        </p>
      </div>
    </Link>
  )
}

export function PhotoTileMasonry({
  photos,
  density = 'comfortable',
  modelCredits = false,
}: {
  photos: TilePhoto[]
  density?: PhotoDensity
  modelCredits?: boolean
}) {
  return (
    <div className={`masonry ${density === 'compact' ? 'mt-4' : 'mt-6'}`}>
      {photos.map((photo) => (
        <PhotoTile key={photo.id} photo={photo} density={density} modelCredits={modelCredits} />
      ))}
    </div>
  )
}
