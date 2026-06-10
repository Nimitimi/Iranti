'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChatInput, type AttachedImage } from '@/components/ChatInput'
import { ChatThread } from '@/components/ChatThread'
import { Gallery } from '@/components/Gallery'
import { Hero } from '@/components/Hero'
import { PromptPills } from '@/components/PromptPills'
import { TopBar } from '@/components/TopBar'
import type { Message } from '@/types'

function HomeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chatParam = searchParams.get('chat')

  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Vision chat: a transient, non-persisted session about an uploaded photo.
  // It lives entirely in local state (no DB chat, no ?chat= URL param).
  const [visionMode, setVisionMode] = useState(false)
  const [visionImage, setVisionImage] = useState<AttachedImage | null>(null)
  const loadedChatRef = useRef<string | null>(null)
  const didMountRef = useRef(false)

  useEffect(() => {
    const ask = searchParams.get('ask')
    if (ask) setPendingPrompt(ask)
  }, [searchParams])

  useEffect(() => {
    // First render after mount: never honour an inherited ?chat= from the URL.
    // The landing state must always be the entry point; chat is only activated
    // by a user action (submit, sidebar nav) which fires this effect later.
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (!chatParam) {
      setActiveChatId(null)
      setMessages([])
      loadedChatRef.current = null
      return
    }
    if (loadedChatRef.current === chatParam) return
    let cancelled = false
    setLoadingChat(true)
    setActiveChatId(chatParam)
    fetch(`/api/chats/${chatParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          router.replace('/')
          return
        }
        loadedChatRef.current = chatParam
        setMessages(data.messages ?? [])
      })
      .catch(() => {
        if (!cancelled) router.replace('/')
      })
      .finally(() => {
        if (!cancelled) setLoadingChat(false)
      })
    return () => {
      cancelled = true
    }
  }, [chatParam, router])

  const notifyChatsChanged = useCallback(() => {
    window.dispatchEvent(new Event('iranti:chats-changed'))
  }, [])

  // Image questions go to the stateless vision endpoint and stay in local
  // state — they are intentionally not saved to the visitor's chat history.
  async function handleVisionSubmit(text: string, image?: AttachedImage) {
    const img = image ?? visionImage
    if (!img || sending) return
    setSending(true)
    if (image) setVisionImage(image)
    if (!visionMode) setVisionMode(true)

    const userMsg: Message = { role: 'user', content: text, image: img.dataUrl }
    const next = [...messages, userMsg]
    setMessages(next)
    try {
      const res = await fetch('/api/ask-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: { data: img.base64, mimeType: img.mimeType },
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.response) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response as string },
      ])
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send'
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I couldn't take a proper look just now. (${errMsg})`,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(text: string, image?: AttachedImage) {
    if (sending) return
    // Once a photo is in play, the whole session is a vision chat.
    if (image || visionMode) {
      return handleVisionSubmit(text, image)
    }
    setSending(true)
    try {
      let chatId = activeChatId
      if (!chatId) {
        const createRes = await fetch('/api/chats', { method: 'POST' })
        const created = await createRes.json()
        if (!createRes.ok || !created.chat?.id) {
          throw new Error(created.error ?? 'Could not start chat')
        }
        chatId = created.chat.id as string
        loadedChatRef.current = chatId
        setActiveChatId(chatId)
        const next = new URLSearchParams(Array.from(searchParams.entries()))
        next.set('chat', chatId)
        router.replace(`/?${next.toString()}`)
      }

      const userMsg: Message = { role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json()
      if (!res.ok || !data.response) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response as string },
      ])
      notifyChatsChanged()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send'
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I couldn't reach my notes just now. (${errMsg})`,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const chatActive = Boolean(activeChatId) || visionMode

  if (chatActive) {
    return (
      <div className="page chat-page">
        <TopBar
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={setSidebarOpen}
          hideExploreLink
        />
        <main
          className={`chat-shell${sidebarOpen ? ' chat-shell-with-sidebar' : ''}`}
        >
          <div className="chat-scroll">
            <div className="chat-msgs">
              <ChatThread
                messages={messages}
                pending={sending}
                variant="chat-active"
              />
            </div>
          </div>
          <div className="chat-dock">
            <ChatInput
              onSubmit={handleSubmit}
              disabled={sending || loadingChat}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <TopBar
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
      />
      <main className="main-content">
        <Hero />
        <div className="content-block">
          <ChatInput
            onSubmit={handleSubmit}
            pendingPrompt={pendingPrompt}
            disabled={sending || loadingChat}
          />
          <div className="discovery">
            <PromptPills onPromptClick={setPendingPrompt} />
            <Gallery />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  )
}
