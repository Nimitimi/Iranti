'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'iranti_explore_seen'
const SHOW_DELAY_MS = 1000
const MOBILE_QUERY = '(max-width: 768px)'

interface ExploreCoachmarkProps {
  /** Ref to the Explore nav button the tooltip points at. */
  anchorRef: React.RefObject<HTMLElement>
  headline?: string
  subline?: string
}

function CompassIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polygon points="15.5 8.5 10.5 10.5 8.5 15.5 13.5 13.5 15.5 8.5" />
    </svg>
  )
}

export function ExploreCoachmark({
  anchorRef,
  headline = 'Discover what is in the museum',
  subline = 'Explore the full Yemisi Shyllon collection',
}: ExploreCoachmarkProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const dismissedRef = useRef(false)

  // Portals need the DOM; only render after mount.
  useEffect(() => setMounted(true), [])

  // First-visit gate: show once, 1s after landing, unless already seen.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let seen = false
    try {
      seen = localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      // localStorage unavailable (private mode etc.) — fail open, show once.
    }
    if (seen) return
    const t = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [])

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore write failures
    }
  }, [])

  // Apply the soft glow ring to the anchor + auto-dismiss when it's clicked.
  // Runs before the measure effect so getBoundingClientRect includes the ring's
  // padding, keeping the dot pinned to the (padded) top-right corner.
  useEffect(() => {
    const el = anchorRef.current
    if (!visible || !el) return
    el.classList.add('coachmark-anchor-active')
    const onClick = () => dismiss()
    el.addEventListener('click', onClick)
    return () => {
      el.classList.remove('coachmark-anchor-active')
      el.removeEventListener('click', onClick)
    }
  }, [visible, anchorRef, dismiss])

  // Track the anchor's position so the portal can follow it on scroll/resize.
  useEffect(() => {
    if (!visible) return
    const el = anchorRef.current
    if (!el) return
    const measure = () => setRect(el.getBoundingClientRect())
    const mq = window.matchMedia(MOBILE_QUERY)
    const onMq = () => setIsMobile(mq.matches)
    onMq()
    measure()
    mq.addEventListener('change', onMq)
    window.addEventListener('resize', measure)
    // capture phase catches scrolls in any nested scroll container too
    window.addEventListener('scroll', measure, true)
    return () => {
      mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [visible, anchorRef])

  // Dismiss on Escape for keyboard users.
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, dismiss])

  if (!mounted || !visible || !rect) return null

  const GAP = 12
  const wrapStyle: React.CSSProperties = isMobile
    ? { top: rect.bottom + GAP, left: rect.left + rect.width / 2 }
    : { top: rect.bottom + GAP, left: rect.left + 6 }

  return createPortal(
    <>
      <span
        className="coachmark-dot"
        style={{ top: rect.top - 3, left: rect.right - 3 }}
        aria-hidden="true"
      />
      <div
        className={`coachmark-wrap${isMobile ? ' is-mobile' : ''}`}
        style={wrapStyle}
      >
        <div
          className="coachmark-tip"
          role="dialog"
          aria-label={headline}
        >
          <span className="coachmark-icon">
            <CompassIcon />
          </span>
          <div className="coachmark-text">
            <div className="coachmark-headline">{headline}</div>
            <div className="coachmark-subline">{subline}</div>
          </div>
          <button
            type="button"
            className="coachmark-close"
            aria-label="Dismiss"
            onClick={dismiss}
          >
            ×
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
