'use client'

type LikertProps = {
  name: string
  value: number | null
  onChange: (value: number) => void
  leftLabel?: string
  rightLabel?: string
  disabled?: boolean
}

const VALUES = [1, 2, 3, 4, 5]

export function Likert({
  name,
  value,
  onChange,
  leftLabel = 'Strongly disagree',
  rightLabel = 'Strongly agree',
  disabled,
}: LikertProps) {
  return (
    <div className="likert" role="radiogroup" aria-label={name}>
      <div className="likert-row">
        {VALUES.map((v) => {
          const selected = value === v
          return (
            <label
              key={v}
              className={`likert-dot${selected ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={v}
                checked={selected}
                onChange={() => onChange(v)}
                disabled={disabled}
              />
              <span className="likert-dot-mark" aria-hidden="true" />
              <span className="likert-dot-num">{v}</span>
            </label>
          )
        })}
      </div>
      <div className="likert-scale">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}
