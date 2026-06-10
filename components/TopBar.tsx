'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { useRef, useState } from 'react'
import { ExploreCoachmark } from './ui/ExploreCoachmark'

function PanelRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
    </svg>
  )
}

type TopBarProps = {
  sidebarOpen?: boolean
  onSidebarOpenChange?: (open: boolean) => void
  hideExploreLink?: boolean
}

type NavItem = { href: string; label: string; match: (p: string | null) => boolean }

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', match: (p) => p === '/' },
  { href: '/explore', label: 'Explore', match: (p) => !!p?.startsWith('/explore') },
  { href: '/feedback', label: 'Feedback', match: (p) => !!p?.startsWith('/feedback') },
]

export function TopBar({
  sidebarOpen: sidebarOpenProp,
  onSidebarOpenChange,
  hideExploreLink,
}: TopBarProps = {}) {
  const pathname = usePathname()
  const [internalOpen, setInternalOpen] = useState(false)
  const exploreRef = useRef<HTMLAnchorElement>(null)

  const controlled = sidebarOpenProp !== undefined
  const sidebarOpen = controlled ? (sidebarOpenProp as boolean) : internalOpen
  const setSidebarOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next)
    onSidebarOpenChange?.(next)
  }

  return (
    <>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className={`topbar${sidebarOpen ? ' topbar-shifted' : ''}`}>
        {!sidebarOpen && (
          <button
            className="sidebar-toggle"
            aria-label="Open sidebar"
            type="button"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelRightIcon />
          </button>
        )}
        {!hideExploreLink && (
          <nav className="topbar-nav" aria-label="Primary">
            {NAV_ITEMS.filter((item) => !item.match(pathname)).map((item) => (
              <Link
                key={item.href}
                ref={item.href === '/explore' ? exploreRef : undefined}
                className="explore-link"
                href={item.href}
              >
                <span className="explore-link-text">{item.label}</span>
              </Link>
            ))}
          </nav>
        )}
        {!hideExploreLink && <ExploreCoachmark anchorRef={exploreRef} />}
      </div>
    </>
  )
}
