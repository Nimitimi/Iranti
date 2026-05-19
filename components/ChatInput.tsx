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
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 80) + 'px'
  }, [value])

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
          'Ask about any artwork, artist, or tradition in our collection…'
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
