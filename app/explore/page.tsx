'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artwork, CategoryDef, Work } from '@/types'
import { ArtworkPanel } from '@/components/ArtworkPanel'
import { InfiniteGrid } from '@/components/InfiniteGrid'

type ViewSize = 'S' | 'M' | 'L'
type ViewMode = 'gallery' | 'infinite'

const FALLBACK_CATEGORIES: CategoryDef[] = [
  { id: 'all', label: 'All works', count: 0 },
]

const LIST_CARD_WIDTHS = [186, 177.475, 199, 186, 177.475, 199]

const LOCAL_FALLBACK_IMAGES = Array.from(
  { length: 16 },
  (_, i) => `/artworks/artwork-${String(i + 1).padStart(2, '0')}.jpg`,
)

function toWork(a: Artwork, index: number): Work {
  return {
    id: a.id,
    title: a.title,
    maker: a.artist ?? a.location ?? '—',
    date: a.year ?? '',
    tag: a.medium ?? a.period ?? undefined,
    img: a.image_url ?? LOCAL_FALLBACK_IMAGES[index % LOCAL_FALLBACK_IMAGES.length],
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function ChevronDownIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

export default function Explore() {
  const router = useRouter()
  const [size, setSize] = useState<ViewSize>('S')
  const [category, setCategory] = useState<string>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [categories, setCategories] = useState<CategoryDef[]>(FALLBACK_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  // Mobile: the search collapses to an icon and expands on tap. No effect on
  // desktop, where the .ask-search pill is always shown.
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    params.set('limit', '200')
    fetch(`/api/artworks?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          return
        }
        setArtworks(Array.isArray(data.artworks) ? data.artworks : [])
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories)
        }
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load artworks')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [category])

  const activeCategory =
    categories.find((c) => c.id === category) ?? categories[0]

  const items: Work[] = useMemo(
    () => artworks.map((a, i) => toWork(a, i)),
    [artworks],
  )

  const artworksById = useMemo(() => {
    const m = new Map<string, Artwork>()
    for (const a of artworks) m.set(a.id, a)
    return m
  }, [artworks])

  const similarArtworks = useMemo(() => {
    if (!selectedArtwork) return [] as Artwork[]
    const samePeriod = artworks.filter(
      (a) =>
        a.id !== selectedArtwork.id &&
        !!a.period &&
        a.period === selectedArtwork.period,
    )
    const others = artworks.filter(
      (a) => a.id !== selectedArtwork.id && !samePeriod.includes(a),
    )
    return [...samePeriod, ...others].slice(0, 3)
  }, [artworks, selectedArtwork])

  function handleCardClick(workId: string) {
    const art = artworksById.get(workId)
    if (art) setSelectedArtwork(art)
  }

  const filterWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!filterOpen) return
    function onDocClick(e: MouseEvent) {
      if (!filterWrapRef.current?.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])

  // Live-filter the loaded artwork list by title or artist. Same logic as
  // the ask-iranti page; reuses the .ask-search* CSS classes for visual
  // parity. Results click through to that artwork's Ask Iranti page.
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return [] as Artwork[]
    return artworks
      .filter((a) => {
        const title = (a.title ?? '').toLowerCase()
        const artist = (a.artist ?? '').toLowerCase()
        return title.includes(q) || artist.includes(q)
      })
      .slice(0, 8)
  }, [searchQuery, artworks])

  useEffect(() => {
    if (!searchOpen) return
    const onDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSearchOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [searchOpen])

  // Collapse the mobile search back to its icon on outside click or Escape.
  useEffect(() => {
    if (!searchExpanded) return
    const onDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setSearchExpanded(false)
        setSearchOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchExpanded(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [searchExpanded])

  const isGalleryMode = viewMode === 'gallery'
  const isInfiniteMode = viewMode === 'infinite'

  const TopNav = (
    <header className="explore-top">
      <Link className="explore-home" href="/">
        HOME
      </Link>
      <div
        className={`ask-search${searchExpanded ? ' is-expanded' : ''}`}
        ref={searchWrapRef}
        onClick={() => {
          // On mobile the collapsed icon expands and focuses the input;
          // on desktop the input is already visible so this is a no-op tap.
          if (!searchExpanded) {
            setSearchExpanded(true)
            requestAnimationFrame(() => searchInputRef.current?.focus())
          }
        }}
      >
        <SearchIcon />
        <input
          ref={searchInputRef}
          type="text"
          className="ask-search-input"
          placeholder="Search by title or artist"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults[0]) {
              e.preventDefault()
              router.push(`/ask-iranti/${searchResults[0].id}`)
              setSearchQuery('')
              setSearchOpen(false)
            }
          }}
        />
        {searchOpen && searchQuery.trim() && (
          <ul className="ask-search-results" role="listbox">
            {searchResults.length === 0 ? (
              <li className="ask-search-empty">No matches</li>
            ) : (
              searchResults.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    className="ask-search-result"
                    onClick={() => {
                      router.push(`/ask-iranti/${a.id}`)
                      setSearchQuery('')
                      setSearchOpen(false)
                    }}
                  >
                    <span className="ask-search-result-title">{a.title}</span>
                    {a.artist && (
                      <span className="ask-search-result-artist">{a.artist}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <div className="explore-top-right">
        <div className="explore-filter-wrap" ref={filterWrapRef}>
          <button
            className={`explore-filter${filterOpen ? ' open' : ''}`}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <span>{activeCategory?.label ?? 'All works'}</span>
            <ChevronDownIcon />
          </button>
          {filterOpen && (
            <ul className="explore-filter-menu" role="listbox">
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === category}
                    className={`explore-filter-item${
                      c.id === category ? ' active' : ''
                    }`}
                    onClick={() => {
                      setCategory(c.id)
                      setFilterOpen(false)
                    }}
                  >
                    <span>{c.label}</span>
                    <span className="explore-filter-count">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  )

  const Controls = (
    <div className="explore-controls">
      <div className="explore-mode-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={isGalleryMode}
          className={`explore-pill${isGalleryMode ? ' active' : ''}`}
          onClick={() => setViewMode('gallery')}
        >
          Gallery
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isInfiniteMode}
          className={`explore-pill${isInfiniteMode ? ' active' : ''}`}
          onClick={() => setViewMode('infinite')}
        >
          Grid
        </button>
      </div>
      <div className="explore-size">
        {(['S', 'M', 'L'] as ViewSize[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`explore-size-btn${size === s ? ' active' : ''}${
              s === 'M' ? ' explore-size-btn-m' : ''
            }`}
            aria-pressed={size === s}
            onClick={() => setSize(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="explore-page explore-page-cards">
      {TopNav}
      {Controls}
      <div className="explore-content">
        {loading && items.length === 0 && (
          <div className="explore-empty">Loading collection…</div>
        )}
        {error && <div className="explore-empty explore-empty-error">{error}</div>}
        {!loading && items.length === 0 && !error && (
          <div className="explore-empty">No works in this category yet.</div>
        )}
        {size === 'S' && items.length > 0 && (
          <ListView items={items} onSelect={handleCardClick} />
        )}
        {size === 'M' && items.length > 0 && (
          <MediumView items={items} onSelect={handleCardClick} />
        )}
        {size === 'L' && artworks.length > 0 && (
          <GalleryView
            artworks={artworks}
            onSelect={(a) => setSelectedArtwork(a)}
          />
        )}
      </div>
      {selectedArtwork && (
        <ArtworkPanel
          artwork={selectedArtwork}
          similar={similarArtworks}
          onClose={() => setSelectedArtwork(null)}
          onSelectSimilar={(a) => setSelectedArtwork(a)}
        />
      )}
      {viewMode === 'infinite' && artworks.length > 0 && (
        <InfiniteGrid
          artworks={artworks}
          onArtworkClick={(a) => setSelectedArtwork(a)}
          onClose={() => setViewMode('gallery')}
        />
      )}
    </div>
  )
}

function ListView({
  items,
  onSelect,
}: {
  items: Work[]
  onSelect: (workId: string) => void
}) {
  const rows = chunk(items, 6)
  return (
    <div className="explore-list">
      {rows.map((row, ri) => (
        <div key={ri} className="explore-list-row">
          {row.map((w, ci) => {
            const width = LIST_CARD_WIDTHS[ci % LIST_CARD_WIDTHS.length]
            return (
              <button
                key={w.id}
                type="button"
                className="explore-list-card"
                style={{ width }}
                onClick={() => onSelect(w.id)}
              >
                <div
                  className="explore-list-img"
                  style={{ width, height: 200 }}
                >
                  {w.img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.img}
                      alt={w.title}
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                </div>
                <div className="explore-list-cap">
                  <div className="explore-list-title">{w.title}</div>
                  <div className="explore-list-sub">
                    {[w.maker, w.date].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function MediumView({
  items,
  onSelect,
}: {
  items: Work[]
  onSelect: (workId: string) => void
}) {
  const rows = chunk(items, 4)
  return (
    <div className="explore-mid">
      {rows.map((row, ri) => (
        <div key={ri} className="explore-mid-row">
          {row.map((w) => (
            <button
              key={w.id}
              type="button"
              className="explore-mid-card"
              onClick={() => onSelect(w.id)}
            >
              <div className="explore-mid-img">
                {w.img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.img}
                    alt={w.title}
                    loading="lazy"
                    draggable={false}
                  />
                )}
              </div>
              <div className="explore-mid-cap">
                <div className="explore-mid-title">{w.title}</div>
                <div className="explore-mid-sub">
                  {[w.maker, w.date].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function GalleryView({
  artworks,
  onSelect,
}: {
  artworks: Artwork[]
  onSelect: (a: Artwork) => void
}) {
  return (
    <div className="explore-gallery-row">
      {artworks.map((a) => {
        const desc = (a.description ?? a.artist_bio ?? '').trim()
        const truncated =
          desc.length > 140 ? `${desc.slice(0, 140).trimEnd()}…` : desc
        return (
          <button
            key={a.id}
            type="button"
            className="explore-gallery-card"
            onClick={() => onSelect(a)}
          >
            <div className="explore-gallery-img">
              {a.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.image_url}
                  alt={a.title}
                  loading="lazy"
                  draggable={false}
                />
              )}
            </div>
            <div className="explore-gallery-cap">
              <div className="explore-gallery-title">{a.title}</div>
              {truncated && (
                <div className="explore-gallery-desc">{truncated}</div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
