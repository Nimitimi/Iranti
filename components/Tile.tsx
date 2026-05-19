import type { Work } from '@/types'

interface TileProps {
  work: Work
  onClick?: (work: Work) => void
}

export function Tile({ work, onClick }: TileProps) {
  const cls =
    'tile' +
    (work.span === 'feature' ? ' feature' : work.span === 'wide' ? ' wide' : '')
  const hasImg = !!work.img

  return (
    <article
      className={cls}
      onClick={() => onClick?.(work)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={'tile-img' + (hasImg ? '' : ' placeholder')}
        style={hasImg ? { backgroundImage: `url(${work.img})` } : undefined}
      >
        {!hasImg && <span>{(work.tag || 'Artwork').toUpperCase()}</span>}
        {work.tag && hasImg && <span className="tile-tag">{work.tag}</span>}
      </div>
      <div className="tile-meta">
        <div className="tile-title">{work.title}</div>
        <div className="tile-sub">
          {work.maker} · {work.date}
        </div>
        <div className="tile-foot">
          <span>View</span>
          <span className="ask">
            <span className="ar">Ask Iranti</span> →
          </span>
        </div>
      </div>
    </article>
  )
}
