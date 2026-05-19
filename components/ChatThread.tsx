'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/types'

interface ChatThreadProps {
  messages: Message[]
  pending?: boolean
  variant?: 'inline' | 'chat-active'
}

function splitFirstSentence(text: string): [string, string] {
  const trimmed = text.trimStart()
  const match = trimmed.match(/^[\s\S]*?[.!?](?=\s|$)/)
  if (!match) return [trimmed, '']
  const head = match[0]
  const tail = trimmed.slice(head.length)
  return [head, tail]
}

export function ChatThread({
  messages,
  pending,
  variant = 'inline',
}: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, pending])

  if (messages.length === 0 && !pending) return null

  const cls = variant === 'chat-active' ? 'chat-thread' : 'home-thread'
  const msgPrefix = variant === 'chat-active' ? 'chat-msg' : 'home-msg'

  return (
    <div className={cls}>
      {messages.map((m, i) => {
        if (m.role === 'user') {
          return (
            <div key={i} className={`${msgPrefix} ${msgPrefix}-user`}>
              {m.content}
            </div>
          )
        }
        const [head, tail] = splitFirstSentence(m.content)
        return (
          <div key={i} className={`${msgPrefix} ${msgPrefix}-assistant`}>
            <span className={`${msgPrefix}-lead`}>{head}</span>
            {tail && <span>{tail}</span>}
          </div>
        )
      })}
      {pending && (
        <div
          className={`${msgPrefix} ${msgPrefix}-assistant ${msgPrefix === 'chat-msg' ? 'chat-typing' : 'home-typing'}`}
        >
          <span />
          <span />
          <span />
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
