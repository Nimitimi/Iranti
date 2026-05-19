'use client'

import { useState } from 'react'
import { CATEGORIES, WORKS } from '@/lib/data'
import { Tile } from './Tile'
import type { Work } from '@/types'

interface BrowseProps {
  tileColumns?: number
  onTileClick?: (work: Work) => void
}

export function Browse({ tileColumns = 4, onTileClick }: BrowseProps) {
  const [active, setActive] = useState('all')
  const works = WORKS[active] ?? []

  return (
    <section className="browse">
      <div className="cat-tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={'cat-tab' + (active === c.id ? ' active' : '')}
            onClick={() => setActive(c.id)}
            role="tab"
            aria-selected={active === c.id}
          >
            {c.label}
            <span className="count">{c.count}</span>
          </button>
        ))}
      </div>

      <div
        className="tile-grid"
        style={{ gridTemplateColumns: `repeat(${tileColumns}, 1fr)` }}
      >
        {works.map((w) => (
          <Tile key={w.id} work={w} onClick={onTileClick} />
        ))}
      </div>
    </section>
  )
}
