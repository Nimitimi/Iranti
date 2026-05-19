'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type SidebarProps = {
  open: boolean
  onToggle: () => void
}

type ChatSummary = { id: string; title: string; updated_at: string }

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

function PlusIcon() {
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
      <path d="M12 5v14M5 12h14" />
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
      <path d="M21 21l-5-5" />
    </svg>
  )
}

function CategoryIcon() {
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
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeChatId = searchParams.get('chat')
  const [chats, setChats] = useState<ChatSummary[]>([])

  const reload = useCallback(() => {
    fetch('/api/chats')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.chats)) setChats(data.chats as ChatSummary[])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    function onChanged() {
      reload()
    }
    window.addEventListener('iranti:chats-changed', onChanged)
    return () => window.removeEventListener('iranti:chats-changed', onChanged)
  }, [reload])

  function openChat(id: string) {
    router.push(`/?chat=${id}`)
  }

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="sidebar-header">
        <span className="sidebar-brand">Iranti</span>
        <button
          className="sidebar-header-toggle"
          aria-label="Close sidebar"
          type="button"
          onClick={onToggle}
        >
          <PanelRightIcon />
        </button>
      </div>

      <Link className="sidebar-nav-item sidebar-nav-new" href="/">
        <PlusIcon />
        <span>New conversation</span>
      </Link>
      <button className="sidebar-nav-item sidebar-nav-search" type="button">
        <SearchIcon />
        <span>Search</span>
      </button>
      <Link className="sidebar-nav-item sidebar-nav-explore" href="/explore">
        <CategoryIcon />
        <span>Explore collection</span>
      </Link>

      <div className="sidebar-recent-label">RECENT</div>
      <div className="sidebar-recent-list">
        {chats.length === 0 ? (
          <div className="sidebar-recent-empty">No conversations yet</div>
        ) : (
          chats.map((c) => (
            <button
              key={c.id}
              className={`sidebar-recent-item${
                c.id === activeChatId ? ' is-active' : ''
              }`}
              type="button"
              onClick={() => openChat(c.id)}
              title={c.title}
            >
              {c.title}
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
