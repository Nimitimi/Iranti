'use client'

import { useEffect, useRef, useState } from 'react'

interface ChatInputProps {
  onSubmit?: (text: string) => void
  pendingPrompt?: string | null
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSubmit,
  pendingPrompt,
  disabled,
  placeholder,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  // Track the mobile breakpoint so we can show a shorter placeholder there.
  // Starts false to match SSR; the effect corrects it on mount (no hydration
  // mismatch since the first client render also reads false).
  const [isMobile, setIsMobile] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 80) + 'px'
  }, [value])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (pendingPrompt) setValue(pendingPrompt)
  }, [pendingPrompt])

  function handleSend() {
    const text = value.trim()
    if (!text || disabled) return
    onSubmit?.(text)
    setValue('')
  }

  return (
    <div className="input-wrap">
      <textarea
        ref={taRef}
        className="input-field"
        placeholder={
          placeholder ??
          (isMobile
            ? 'Ask about any artwork'
            : 'Ask about any artwork, artist, or tradition in our collection…')
        }
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        rows={1}
        disabled={disabled}
      />
      <div className="input-row">
        <button type="button" className="input-attach" aria-label="Attach">
          +
        </button>
        <button
          type="button"
          className="send-btn"
          aria-label="Ask Iranti"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
