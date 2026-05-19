'use client'

import { PROMPT_PILLS } from '@/lib/data'

interface PromptPillsProps {
  onPromptClick?: (text: string) => void
}

export function PromptPills({ onPromptClick }: PromptPillsProps) {
  return (
    <div className="prompt-pills">
      {PROMPT_PILLS.map((p, i) => (
        <button
          key={i}
          type="button"
          className="prompt-pill"
          onClick={() => onPromptClick?.(p.text)}
        >
          {p.text}
          {p.arrow && <span className="arrow"> →</span>}
        </button>
      ))}
    </div>
  )
}
