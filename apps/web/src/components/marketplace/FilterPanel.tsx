import { Link } from 'react-router'
import { LIBRARY_TIER_LABEL, type LibraryTier } from '@vuekumi/shared'

export type FacetRow = { value: string; count: number }

export function FilterOption({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm ${
        active ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
          active ? 'border-terra bg-terra text-white' : 'border-sand bg-white'
        }`}
      >
        {active ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && <span className="text-xs text-ink-faint">{count}</span>}
    </button>
  )
}

export function LibraryFilterPanel({
  q,
  category,
  country,
  license,
  libraryTier,
  tag,
  photographer,
  categoryOptions,
  tierOptions,
  countryOptions,
  tagOptions,
  onFilter,
  onClearHref = '/search',
}: {
  q: string
  category: string
  country: string
  license: string
  libraryTier: string
  tag: string
  photographer: string
  categoryOptions: FacetRow[]
  tierOptions: FacetRow[]
  countryOptions: FacetRow[]
  tagOptions: FacetRow[]
  onFilter: (next: Record<string, string>) => void
  onClearHref?: string
}) {
  const hasFilters = Boolean(q || category || country || license || libraryTier || tag || photographer)

  return (
    <aside className="rounded-2xl border border-sand bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Filter Results</p>
        {hasFilters && (
          <Link to={onClearHref} className="text-xs font-semibold text-terra">
            Clear all
          </Link>
        )}
      </div>

      <div className="mt-4 border-t border-sand pt-4">
        <p className="text-sm font-semibold text-ink">Category</p>
        <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          <FilterOption active={!category} label="All categories" onClick={() => onFilter({ category: '' })} />
          {categoryOptions.map((row) => (
            <FilterOption
              key={row.value}
              active={category === row.value}
              label={row.value}
              count={row.count}
              onClick={() => onFilter({ category: category === row.value ? '' : row.value })}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-sand pt-4">
        <p className="text-sm font-semibold text-ink">License type</p>
        <div className="mt-2">
          <FilterOption active={!license} label="All licences" onClick={() => onFilter({ license: '' })} />
          <FilterOption
            active={license === 'free'}
            label="Free"
            onClick={() => onFilter({ license: license === 'free' ? '' : 'free' })}
          />
          <FilterOption
            active={license === 'premium'}
            label="Premium"
            onClick={() => onFilter({ license: license === 'premium' ? '' : 'premium' })}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-sand pt-4">
        <p className="text-sm font-semibold text-ink">Library</p>
        <div className="mt-2">
          <FilterOption
            active={!libraryTier}
            label="All library tiers"
            onClick={() => onFilter({ libraryTier: '' })}
          />
          {tierOptions.map((row) => {
            const tier = row.value as LibraryTier
            const label = LIBRARY_TIER_LABEL[tier] ?? row.value
            return (
              <FilterOption
                key={row.value}
                active={libraryTier === row.value}
                label={label}
                count={row.count}
                onClick={() => onFilter({ libraryTier: libraryTier === row.value ? '' : row.value })}
              />
            )
          })}
        </div>
        {libraryTier === 'VERIFIED_PLUS' && (
          <p className="mt-2 text-[11px] text-ink-soft">
            Verified+ is marketplace placement above Licensed. It is separate from rights clearance.
          </p>
        )}
        {libraryTier === 'OPEN' && (
          <p className="mt-2 text-[11px] text-ink-soft">
            Free Library (Open) — zero-price downloads when rights allow. Photo Influencers upload here only.
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-sand pt-4">
        <p className="text-sm font-semibold text-ink">Country</p>
        <select
          aria-label="Country"
          value={country}
          onChange={(e) => onFilter({ country: e.target.value })}
          className="mt-2 w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:border-terra"
        >
          <option value="">All countries</option>
          {countryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value} ({c.count})
            </option>
          ))}
        </select>
      </div>

      {tagOptions.length > 0 && (
        <div className="mt-4 border-t border-sand pt-4">
          <p className="text-sm font-semibold text-ink">Topics</p>
          <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {tagOptions.map((row) => (
              <FilterOption
                key={row.value}
                active={tag === row.value}
                label={row.value}
                count={row.count}
                onClick={() => onFilter({ tag: tag === row.value ? '' : row.value })}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
