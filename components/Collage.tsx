import { WORKS } from '@/lib/data'

const SPANS = [
  { c: 'span 2', r: 'span 2' },
  { c: 'span 1', r: 'span 1' },
  { c: 'span 2', r: 'span 2' },
  { c: 'span 1', r: 'span 1' },
  { c: 'span 1', r: 'span 2' },
  { c: 'span 1', r: 'span 1' },
  { c: 'span 2', r: 'span 1' },
  { c: 'span 1', r: 'span 1' },
  { c: 'span 1', r: 'span 1' },
  { c: 'span 2', r: 'span 1' },
  { c: 'span 1', r: 'span 2' },
  { c: 'span 2', r: 'span 2' },
  { c: 'span 1', r: 'span 1' },
  { c: 'span 1', r: 'span 1' },
  { c: 'span 2', r: 'span 1' },
  { c: 'span 1', r: 'span 1' },
]

export function Collage({ visible = true, opacity = 20 }: { visible?: boolean; opacity?: number }) {
  if (!visible) return null

  const sources = [
    ...WORKS.bronze,
    ...WORKS.mask,
    ...WORKS.terracotta,
    ...WORKS.textile,
    ...WORKS.sacred,
  ].slice(0, 16)

  return (
    <div className="collage" aria-hidden="true">
      <div className="collage-grid" style={{ opacity: opacity / 100 }}>
        {sources.map((s, i) => (
          <div
            key={s.id}
            className="collage-tile"
            style={{
              gridColumn: SPANS[i]?.c,
              gridRow: SPANS[i]?.r,
              backgroundImage: s.img ? `url(${s.img})` : 'none',
            }}
          />
        ))}
      </div>
      <div className="collage-fade" />
    </div>
  )
}
