'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Artwork } from '@/types'

interface InfiniteGridProps {
  artworks: Artwork[]
  onArtworkClick: (artwork: Artwork) => void
  onClose: () => void
}

const COLS = 3
const ROWS = 3
const EASING = 0.1
const ROTATION_STRENGTH = 0.1
const ROTATION_EASING = 0.06
const SCALE_EASING = 0.08
const MAX_SCALE_EFFECT = 0.2
const TILE_OVERSCAN = 1
const COVER_FACTOR = 1.4
const SCROLL_DECAY = 0.85
const GAP = 12
const CARD_ASPECT = 4 / 3

type Vec = { x: number; y: number }

interface GridItem {
  el: HTMLDivElement
  baseX: number
  baseY: number
  tileX: number
  tileY: number
}

interface GridState {
  cameraOffset: Vec
  targetOffset: Vec
  isDragging: boolean
  prevMouse: Vec
  containerScale: number
  targetScale: number
  containerRotX: number
  containerRotY: number
  targetRotX: number
  targetRotY: number
  scrollSpeed: number
  cellWidth: number
  cellHeight: number
  tilesX: number
  tilesY: number
  items: GridItem[]
  raf: number | null
}

export function InfiniteGrid({
  artworks,
  onArtworkClick,
  onClose,
}: InfiniteGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GridState | null>(null)
  const artworksRef = useRef<Artwork[]>(artworks)
  const onClickRef = useRef(onArtworkClick)
  const onCloseRef = useRef(onClose)
  const [hintHidden, setHintHidden] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHintHidden(true), 5000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    artworksRef.current = artworks
  }, [artworks])

  useEffect(() => {
    onClickRef.current = onArtworkClick
  }, [onArtworkClick])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const buildItems = useCallback(() => {
    const grid = gridRef.current
    const viewport = viewportRef.current
    const state = stateRef.current
    if (!grid || !viewport || !state) return

    grid.innerHTML = ''

    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    const cell = Math.max(vw / COLS, vh / ROWS) * (1 / (1 - MAX_SCALE_EFFECT))
    state.cellWidth = cell
    state.cellHeight = cell / CARD_ASPECT
    // Minimum 3 tiles per axis: with only 2 tiles, the modulo wrap can leave
    // a blank band when the camera offset approaches totalW/totalH (the spec
    // formula under-counts for viewports smaller than cellHeight*ROWS).
    state.tilesX = Math.max(
      3,
      Math.ceil((vw * COVER_FACTOR) / (cell * COLS)) + TILE_OVERSCAN,
    )
    state.tilesY = Math.max(
      3,
      Math.ceil((vh * COVER_FACTOR) / (cell * ROWS)) + TILE_OVERSCAN,
    )

    const list = artworksRef.current
    if (list.length === 0) {
      state.items = []
      return
    }

    const totalW = state.cellWidth * COLS + GAP * (COLS - 1)
    const totalH = state.cellHeight * ROWS + GAP * (ROWS - 1)
    grid.style.width = `${totalW}px`
    grid.style.height = `${totalH}px`
    grid.style.left = `${(vw - totalW) / 2}px`
    grid.style.top = `${(vh - totalH) / 2}px`

    const tileXStart = -Math.floor(state.tilesX / 2)
    const tileXEnd = tileXStart + state.tilesX
    const tileYStart = -Math.floor(state.tilesY / 2)
    const tileYEnd = tileYStart + state.tilesY

    const items: GridItem[] = []
    let cellIndex = 0
    for (let ty = tileYStart; ty < tileYEnd; ty++) {
      for (let tx = tileXStart; tx < tileXEnd; tx++) {
        for (let by = 0; by < ROWS; by++) {
          for (let bx = 0; bx < COLS; bx++) {
            const artwork = list[cellIndex % list.length]
            cellIndex++
            const el = document.createElement('div')
            el.className = 'ig-item'
            el.style.width = `${state.cellWidth}px`
            el.style.height = `${state.cellHeight}px`

            if (artwork.image_url) {
              const img = document.createElement('img')
              img.src = artwork.image_url
              img.alt = artwork.title ?? ''
              img.draggable = false
              img.loading = 'lazy'
              el.appendChild(img)
            }

            el.addEventListener('click', (ev) => {
              ev.stopPropagation()
              onClickRef.current(artwork)
            })

            grid.appendChild(el)
            items.push({ el, baseX: bx, baseY: by, tileX: tx, tileY: ty })
          }
        }
      }
    }
    state.items = items
  }, [])

  const updateItemPositions = useCallback(() => {
    const state = stateRef.current
    if (!state) return
    const totalW = state.cellWidth * COLS + GAP * (COLS - 1)
    const totalH = state.cellHeight * ROWS + GAP * (ROWS - 1)
    if (totalW === 0 || totalH === 0) return
    const offsetX = ((state.cameraOffset.x % totalW) + totalW) % totalW
    const offsetY = ((state.cameraOffset.y % totalH) + totalH) % totalH
    const stepX = state.cellWidth + GAP
    const stepY = state.cellHeight + GAP
    for (const it of state.items) {
      const x = it.baseX * stepX + it.tileX * totalW - offsetX
      const y = it.baseY * stepY + it.tileY * totalH - offsetY
      it.el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    const container = containerRef.current
    if (!viewport || !container) return

    const state: GridState = {
      cameraOffset: { x: 0, y: 0 },
      targetOffset: { x: 0, y: 0 },
      isDragging: false,
      prevMouse: { x: 0, y: 0 },
      containerScale: 1,
      targetScale: 1,
      containerRotX: 0,
      containerRotY: 0,
      targetRotX: 0,
      targetRotY: 0,
      scrollSpeed: 0,
      cellWidth: 0,
      cellHeight: 0,
      tilesX: 0,
      tilesY: 0,
      items: [],
      raf: null,
    }
    stateRef.current = state

    buildItems()
    updateItemPositions()

    let dragDistance = 0
    let suppressClick = false

    function onPointerDown(e: PointerEvent) {
      state.isDragging = true
      state.prevMouse.x = e.clientX
      state.prevMouse.y = e.clientY
      dragDistance = 0
      suppressClick = false
      viewport!.classList.add('ig-dragging')
      try {
        viewport!.setPointerCapture(e.pointerId)
      } catch {}
    }
    function onPointerMove(e: PointerEvent) {
      if (!state.isDragging) return
      const dx = e.clientX - state.prevMouse.x
      const dy = e.clientY - state.prevMouse.y
      state.prevMouse.x = e.clientX
      state.prevMouse.y = e.clientY
      state.targetOffset.x -= dx
      state.targetOffset.y -= dy
      state.scrollSpeed += Math.abs(dx) + Math.abs(dy)
      state.targetRotX = dx * ROTATION_STRENGTH
      state.targetRotY = -dy * ROTATION_STRENGTH
      dragDistance += Math.abs(dx) + Math.abs(dy)
      if (dragDistance > 6) suppressClick = true
    }
    function endDrag(e?: PointerEvent) {
      if (!state.isDragging) return
      state.isDragging = false
      state.targetRotX = 0
      state.targetRotY = 0
      viewport!.classList.remove('ig-dragging')
      if (e) {
        try {
          viewport!.releasePointerCapture(e.pointerId)
        } catch {}
      }
    }
    function onClickCapture(e: MouseEvent) {
      if (suppressClick) {
        e.stopPropagation()
        e.preventDefault()
        suppressClick = false
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      state.targetOffset.x += e.deltaX
      state.targetOffset.y += e.deltaY
      state.scrollSpeed += Math.abs(e.deltaX) + Math.abs(e.deltaY)
    }
    function onResize() {
      buildItems()
      updateItemPositions()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }

    viewport.addEventListener('pointerdown', onPointerDown)
    viewport.addEventListener('pointermove', onPointerMove)
    viewport.addEventListener('pointerup', endDrag)
    viewport.addEventListener('pointercancel', endDrag)
    viewport.addEventListener('pointerleave', () => endDrag())
    viewport.addEventListener('click', onClickCapture, true)
    viewport.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)

    function tick() {
      const s = stateRef.current
      if (!s) return
      s.cameraOffset.x += (s.targetOffset.x - s.cameraOffset.x) * EASING
      s.cameraOffset.y += (s.targetOffset.y - s.cameraOffset.y) * EASING
      updateItemPositions()

      s.scrollSpeed *= SCROLL_DECAY
      const speed = Math.min(s.scrollSpeed / 80, 1)
      s.targetScale = 1 - MAX_SCALE_EFFECT * speed
      s.containerScale += (s.targetScale - s.containerScale) * SCALE_EASING
      s.containerRotX += (s.targetRotX - s.containerRotX) * ROTATION_EASING
      s.containerRotY += (s.targetRotY - s.containerRotY) * ROTATION_EASING

      container!.style.transform = `scale(${s.containerScale}) skewY(${s.containerRotX}deg) skewX(${s.containerRotY}deg)`

      s.raf = requestAnimationFrame(tick)
    }
    state.raf = requestAnimationFrame(tick)

    return () => {
      if (state.raf !== null) cancelAnimationFrame(state.raf)
      viewport.removeEventListener('pointerdown', onPointerDown)
      viewport.removeEventListener('pointermove', onPointerMove)
      viewport.removeEventListener('pointerup', endDrag)
      viewport.removeEventListener('pointercancel', endDrag)
      viewport.removeEventListener('click', onClickCapture, true)
      viewport.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      stateRef.current = null
    }
  }, [buildItems, updateItemPositions])

  // Rebuild grid if the artwork list size changes (avoid holes when data
  // arrives after mount).
  useEffect(() => {
    if (!stateRef.current) return
    buildItems()
    updateItemPositions()
  }, [artworks.length, buildItems, updateItemPositions])

  return (
    <div className="ig-viewport" ref={viewportRef} aria-label="Infinite grid">
      <div className="ig-container" ref={containerRef}>
        <div className="ig-grid" ref={gridRef} />
      </div>
      <div className={`ig-hint${hintHidden ? ' hidden' : ''}`} aria-hidden="true">
        <span className="ig-dot" />
        Press ESC to leave
      </div>
    </div>
  )
}
