'use client'

import { useEffect, useState } from 'react'
import type { Artwork } from '@/types'

type Slot = {
  containerWidth: number
  imageWidth: number
  textGap: number
}

const SLOTS: Slot[] = [
  { containerWidth: 186, imageWidth: 186, textGap: 16 },
  { containerWidth: 177.475, imageWidth: 148, textGap: 10 },
  { containerWidth: 199, imageWidth: 199, textGap: 16 },
]

function formatSubtitle(a: Artwork): string {
  const left = a.artist ?? a.period ?? a.location ?? ''
  const right = a.year ?? ''
  if (left && right) return `${left} · ${right}`
  return left || right || (a.medium ?? '')
}

export function Gallery() {
  const [items, setItems] = useState<Artwork[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/artworks?limit=3')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data.artworks)) {
          setItems(data.artworks.slice(0, 3))
        }
      })
      .catch((err) => {
        console.error('[Gallery] fetch failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (items.length === 0) {
    return (
      <div className="gallery">
        {SLOTS.map((slot, i) => (
          <figure
            key={i}
            className="gallery-item"
            style={{ width: slot.containerWidth, gap: slot.textGap }}
            aria-hidden="true"
          >
            <div
              className="gallery-image gallery-image-skeleton"
              style={{ width: slot.imageWidth, height: 200 }}
            />
          </figure>
        ))}
      </div>
    )
  }

  return (
    <div className="gallery">
      {items.map((art, i) => {
        const slot = SLOTS[i % SLOTS.length]
        return (
          <figure
            key={art.id}
            className="gallery-item"
            style={{ width: slot.containerWidth, gap: slot.textGap }}
          >
            <div
              className="gallery-image"
              style={{ width: slot.imageWidth, height: 200 }}
            >
              {art.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={art.image_url}
                  alt={art.title}
                  loading="lazy"
                  draggable={false}
                />
              )}
            </div>
            <figcaption className="gallery-caption">
              <div className="gallery-title">{art.title}</div>
              <div className="gallery-sub">{formatSubtitle(art)}</div>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}
