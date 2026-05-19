'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artwork, Message } from '@/types'

function buildSuggestions(a: Artwork): string[] {
  const title = a.title
  const candidates: string[] = []
  if (a.artist) {
    candidates.push(`Tell me more about ${a.artist}`)
  }
  if (a.medium) {
    candidates.push(`How was ${title} made?`)
  }
  if (a.year) {
    candidates.push(`What was happening in art when this was created?`)
  } else if (a.period) {
    candidates.push(`What defines the ${a.period} tradition?`)
  }
  candidates.push(`What's the significance of ${title}?`)
  if (a.location) {
    candidates.push(`Where does this work come from?`)
  }
  // Always pick 2 unique prompts; first preferences win.
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of candidates) {
    if (seen.has(c)) continue
    seen.add(c)
    out.push(c)
    if (out.length === 2) break
  }
  return out
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

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

export default function AskIranti() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [displayedOpening, setDisplayedOpening] = useState('')
  const threadEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/artworks?limit=200')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) {
          setLoadError(d.error)
          return
        }
        const list = (d.artworks ?? []) as Artwork[]
        setArtworks(list)
        const found = list.find((a) => a.id === params.id) ?? null
        setArtwork(found)
        if (found?.description) {
          setMessages([{ role: 'assistant', content: found.description }])
        } else {
          setMessages([])
        }
      })
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : 'Failed to load'),
      )
    return () => {
      cancelled = true
    }
  }, [params.id])

  const prevArtwork = useMemo(() => {
    if (!artwork || artworks.length === 0) return null
    const idx = artworks.findIndex((a) => a.id === artwork.id)
    if (idx <= 0) return null
    return artworks[idx - 1]
  }, [artwork, artworks])

  const suggestions = useMemo(
    () => (artwork ? buildSuggestions(artwork) : []),
    [artwork],
  )

  // Live-filter the already-loaded artwork list by title or artist.
  // Cap at 8 results so the dropdown stays scannable.
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

  // Close the search dropdown on outside click or Escape.
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

  const similar = useMemo(() => {
    if (!artwork || artworks.length === 0) return [] as Artwork[]
    const samePeriod = artworks.filter(
      (a) =>
        a.id !== artwork.id &&
        !!a.period &&
        a.period === artwork.period,
    )
    const others = artworks.filter(
      (a) => a.id !== artwork.id && !samePeriod.includes(a),
    )
    return [...samePeriod, ...others].slice(0, 3)
  }, [artwork, artworks])

  // Typewriter stream for the opening (the artwork description as Iranti's first turn)
  useEffect(() => {
    const full = artwork?.description ?? ''
    if (!full) {
      setDisplayedOpening('')
      return
    }
    setDisplayedOpening('')
    let i = 0
    const STEP = 3
    const interval = window.setInterval(() => {
      i = Math.min(full.length, i + STEP)
      setDisplayedOpening(full.slice(0, i))
      if (i >= full.length) window.clearInterval(interval)
    }, 18)
    return () => window.clearInterval(interval)
  }, [artwork?.id, artwork?.description])

  // Scroll the internal chat container — never the window. Heading + desc
  // live inside the scroller too, so they slide up as the conversation
  // grows (matching Figma frame 136:210 where description y=-55 — scrolled
  // out of frame). Only fires when the message list changes so the
  // typewriter doesn't fight the scroll position.
  useEffect(() => {
    const el = chatScrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      threadEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [messages.length, sending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending || !artwork) return
    const userMsg: Message = { role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ask-iranti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id, messages: next }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.response as string },
      ])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to send'
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Sorry, I couldn't reach my notes just now. (${errMsg})`,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  if (loadError) {
    return (
      <div className="ask-page">
        <div className="ask-status">{loadError}</div>
      </div>
    )
  }

  if (!artwork) {
    return (
      <div className="ask-page">
        <div className="ask-status">Loading…</div>
      </div>
    )
  }

  const hasUserMessages = messages.some((m) => m.role === 'user')
  const opening = messages[0]
  const restMessages = messages.slice(1)

  return (
    <div className="ask-page">
      <header className="ask-top">
        <Link className="ask-back" href="/explore">
          Explore
        </Link>
        <div className="ask-search" ref={searchWrapRef}>
          <SearchIcon />
          <input
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
      </header>

      <main className="ask-main">
        {prevArtwork && prevArtwork.image_url && (
          <button
            type="button"
            className="ask-prev"
            onClick={() => router.push(`/ask-iranti/${prevArtwork.id}`)}
            aria-label={`Previous: ${prevArtwork.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={prevArtwork.image_url}
              alt={prevArtwork.title}
              draggable={false}
            />
          </button>
        )}

        <div className="ask-image">
          {artwork.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artwork.image_url}
              alt={artwork.title}
              draggable={false}
            />
          )}
        </div>

        <div className="ask-right">
          <div className="ask-chat-scroll" ref={chatScrollRef}>
            <header className="ask-heading">
              <h1 className="ask-title">{artwork.title}</h1>
              {artwork.artist && (
                <div className="ask-artist">{artwork.artist}</div>
              )}
            </header>
            <div className="ask-desc">
              {opening?.content ? (
                <p>
                  {displayedOpening || ' '}
                  {displayedOpening.length < (opening.content?.length ?? 0) && (
                    <span className="ask-desc-caret" aria-hidden="true" />
                  )}
                </p>
              ) : null}
            </div>

            {restMessages.length > 0 && (
              <div className="ask-thread">
                {restMessages.map((m, i) => (
                  <div key={i} className={`ask-msg ask-msg-${m.role}`}>
                    {m.content}
                  </div>
                ))}
                {sending && (
                  <div className="ask-msg ask-msg-assistant ask-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>
            )}

            {!hasUserMessages && suggestions.length > 0 && (
              <div className="ask-suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="ask-pill"
                    onClick={() => send(s)}
                    disabled={sending}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          <div className="ask-input-sticky">
            <div className="ask-input-wrap">
              <input
                type="text"
                className="ask-input"
                placeholder="What's on your mind"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    send(input)
                  }
                }}
                disabled={sending}
              />
              <button
                type="button"
                className="ask-send"
                onClick={() => send(input)}
                disabled={!input.trim() || sending}
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </main>

      {similar.length > 0 && (
        <section className="ask-similar">
          <h2 className="ask-similar-h2">Similar Artwork</h2>
          <div className="ask-similar-row">
            {similar.map((s) => (
              <button
                key={s.id}
                type="button"
                className="ask-similar-card"
                onClick={() => router.push(`/ask-iranti/${s.id}`)}
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
                <div className="ask-similar-caption">
                  <div className="ask-similar-title">{s.title}</div>
                  {s.artist && (
                    <div className="ask-similar-artist">{s.artist}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
