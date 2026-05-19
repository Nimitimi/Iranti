'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { useState } from 'react'

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

export function TopBar({
  sidebarOpen: sidebarOpenProp,
  onSidebarOpenChange,
  hideExploreLink,
}: TopBarProps = {}) {
  const pathname = usePathname()
  const onExplore = pathname?.startsWith('/explore')
  const navHref = onExplore ? '/' : '/explore'
  const navLabel = onExplore ? 'Home' : 'Explore'
  const [internalOpen, setInternalOpen] = useState(false)

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
          <Link className="explore-link" href={navHref}>
            <span className="explore-link-text">{navLabel}</span>
          </Link>
        )}
      </div>
    </>
  )
}
