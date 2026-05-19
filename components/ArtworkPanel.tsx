'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Artwork } from '@/types'

interface ArtworkPanelProps {
  artwork: Artwork
  similar: Artwork[]
  onClose: () => void
  onSelectSimilar: (a: Artwork) => void
}

const SIMILAR_SLOTS = [
  { w: 150, h: 160 },
  { w: 150, h: 140 },
  { w: 150, h: 150 },
]

function LinkIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  )
}

export function ArtworkPanel({
  artwork,
  similar,
  onClose,
  onSelectSimilar,
}: ArtworkPanelProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [artwork.id])

  function handleAskIranti() {
    router.push(`/ask-iranti/${artwork.id}`)
  }

  const details = [
    artwork.year,
    artwork.medium,
    artwork.location,
  ].filter(Boolean) as string[]

  return (
    <>
      <button
        type="button"
        className="artwork-panel-scrim"
        onClick={onClose}
        aria-label="Close details"
      />
      <aside className="artwork-panel" aria-label="Artwork details">
        <button
          type="button"
          className="artwork-panel-close"
          onClick={onClose}
          aria-label="Close details"
        >
          <CloseIcon />
        </button>
      <div className="artwork-panel-scroll" ref={scrollRef}>
        <header className="artwork-panel-header">
          <div className="artwork-panel-headtext">
            <h1 className="artwork-panel-title">{artwork.title}</h1>
            {artwork.artist && (
              <div className="artwork-panel-artist">{artwork.artist}</div>
            )}
          </div>
          <button
            type="button"
            className="ask-iranti-btn"
            onClick={handleAskIranti}
          >
            <LinkIcon />
            <span>Ask iranti</span>
          </button>
        </header>

        <div className="artwork-panel-image">
          {artwork.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artwork.image_url}
              alt={artwork.title}
              draggable={false}
            />
          )}
        </div>

        <section className="artwork-panel-about">
          <h2 className="artwork-panel-h2">About the Artwork</h2>
          {artwork.description && (
            <p className="artwork-panel-body">{artwork.description}</p>
          )}
          {details.length > 0 && (
            <div className="artwork-panel-details">
              {details.map((d) => (
                <div key={d} className="artwork-panel-detail">
                  {d}
                </div>
              ))}
            </div>
          )}
        </section>

        {similar.length > 0 && (
          <section className="artwork-panel-similar">
            <h2 className="artwork-panel-h2">Similar Artwork</h2>
            <div className="similar-row">
              {similar.slice(0, 3).map((s, i) => {
                const slot = SIMILAR_SLOTS[i]
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="similar-card"
                    style={{ width: slot.w, height: slot.h }}
                    onClick={() => onSelectSimilar(s)}
                    aria-label={s.title}
                  >
                    {s.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image_url}
                        alt={s.title}
                        draggable={false}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}
        </div>
      </aside>
    </>
  )
}
