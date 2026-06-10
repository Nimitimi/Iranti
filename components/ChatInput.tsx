'use client'

import { useEffect, useRef, useState } from 'react'

export interface AttachedImage {
  // data-URL for inline preview/display
  dataUrl: string
  // bare base64 (no data: prefix) for the API
  base64: string
  mimeType: string
}

interface ChatInputProps {
  onSubmit?: (text: string, image?: AttachedImage) => void
  pendingPrompt?: string | null
  disabled?: boolean
  placeholder?: string
}

// Downscale large phone photos before upload: cap the longest edge and re-encode
// as JPEG so requests stay small and fast (Gemini inline data has size limits).
const MAX_EDGE = 1024
const JPEG_QUALITY = 0.85

function readImageFile(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load image'))
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas unsupported'))
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        const base64 = dataUrl.split(',')[1] ?? ''
        resolve({ dataUrl, base64, mimeType: 'image/jpeg' })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function ChatInput({
  onSubmit,
  pendingPrompt,
  disabled,
  placeholder,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [attached, setAttached] = useState<AttachedImage | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  // Track the mobile breakpoint so we can show a shorter placeholder there.
  // Starts false to match SSR; the effect corrects it on mount (no hydration
  // mismatch since the first client render also reads false).
  const [isMobile, setIsMobile] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  async function handleFile(file: File | undefined) {
    if (!file) return
    setAttachError(null)
    if (!file.type.startsWith('image/')) {
      setAttachError('Please choose an image file.')
      return
    }
    try {
      const img = await readImageFile(file)
      setAttached(img)
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : 'Could not read image')
    }
  }

  function handleSend() {
    const text = value.trim()
    if (disabled) return
    if (!text && !attached) return
    // An image with no question still gets a sensible default prompt.
    const finalText =
      text || (attached ? 'What can you tell me about this artwork?' : '')
    onSubmit?.(finalText, attached ?? undefined)
    setValue('')
    setAttached(null)
    setAttachError(null)
  }

  const canSend = !disabled && (!!value.trim() || !!attached)

  return (
    <div className="input-wrap">
      {attached && (
        <div className="input-attachment">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attached.dataUrl} alt="Attached" className="input-attachment-thumb" />
          <button
            type="button"
            className="input-attachment-remove"
            aria-label="Remove image"
            onClick={() => setAttached(null)}
          >
            ×
          </button>
        </div>
      )}
      {attachError && <div className="input-attach-error">{attachError}</div>}
      <textarea
        ref={taRef}
        className="input-field"
        placeholder={
          placeholder ??
          (attached
            ? 'Ask about this image…'
            : isMobile
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
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          // On mobile, opens the camera directly; ignored on desktop.
          capture="environment"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            // Reset so picking the same file again re-fires onChange.
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="input-attach"
          aria-label="Attach a photo"
          title="Attach or take a photo"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
        >
          +
        </button>
        <button
          type="button"
          className="send-btn"
          aria-label="Ask Iranti"
          onClick={handleSend}
          disabled={!canSend}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
