'use client'

import { WORKS } from '@/lib/data'
import { Tile } from './Tile'
import type { Work } from '@/types'

interface ArtworkRowProps {
  onCardClick?: (work: Work) => void
}

export function ArtworkRow({ onCardClick }: ArtworkRowProps) {
  // Strip span hints + material tags — the homepage row lays cards out at equal
  // width and the spec calls for no material badges on these tiles.
  const cards = WORKS.all
    .slice(0, 3)
    .map((w) => ({ ...w, span: undefined, tag: undefined }))
  return (
    <div className="discovery-row">
      {cards.map((w) => (
        <Tile key={w.id} work={w} onClick={onCardClick} />
      ))}
    </div>
  )
}
