'use client'

import { CURIOSITY } from '@/lib/data'

interface CuriosityProps {
  onQuestionClick?: (q: string) => void
}

export function Curiosity({ onQuestionClick }: CuriosityProps) {
  return (
    <section className="curiosity">
      <div className="cur-label">
        Questions you<br />didn&apos;t know<br />you had
      </div>
      <div className="cur-questions">
        {CURIOSITY.map((q, i) => (
          <div
            key={i}
            className="cur-q"
            onClick={() => onQuestionClick?.(q)}
            role={onQuestionClick ? 'button' : undefined}
            tabIndex={onQuestionClick ? 0 : undefined}
          >
            <span className="cur-q-text">{q}</span>
            <span className="cur-q-arrow">→</span>
          </div>
        ))}
      </div>
    </section>
  )
}
