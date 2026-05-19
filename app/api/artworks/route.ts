import { NextResponse } from 'next/server'
import { request as httpsRequest } from 'node:https'
import { supabase } from '@/lib/supabase'
import type { Artwork } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELECT_COLUMNS =
  'id, title, artist, year, medium, description, artist_bio, location, period, provenance, image_url, source_url'

// Google Arts & Culture image URLs in the catalogue end with transform params
// like `=x0-y0-z0-nt0...` (returns a 512×512 pyramid tile with black padding)
// or `=fcrop64=...` (returns a partial crop). Strip those and request a clean
// resized image instead so the real artwork fills our frames edge-to-edge.
function normalizeImageUrl(url: string | null): string | null {
  if (!url) return url
  if (!url.includes('lh3.googleusercontent.com')) return url
  const eq = url.indexOf('=')
  const base = eq === -1 ? url : url.slice(0, eq)
  return `${base}=s1000`
}

// Google's CDN answers HTTP 200 with a fixed 50,300-byte PNG placeholder when
// the image ID is invalid/expired. Real artworks come back as JPEGs. We probe
// each candidate URL once and cache the result so we don't ship placeholder
// cards to the gallery.
type ValidityEntry = { ok: boolean; checkedAt: number }
const URL_VALIDITY = new Map<string, ValidityEntry>()
const VALIDITY_TTL_MS = 60 * 60 * 1000

type ProbeOutcome = 'ok' | 'placeholder' | 'transient'

function headProbe(url: string, timeoutMs = 8000): Promise<ProbeOutcome> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: ProbeOutcome, reason: string) => {
      if (settled) return
      settled = true
      if (outcome !== 'ok') console.warn('[headProbe]', outcome, reason, url.slice(-50))
      resolve(outcome)
    }
    const req = httpsRequest(url, { method: 'HEAD' }, (res) => {
      const ct = res.headers['content-type'] ?? ''
      if (res.statusCode === 200 && ct.includes('image/png')) {
        finish('placeholder', `status=200 ct=${ct}`)
      } else if (res.statusCode === 200) {
        finish('ok', `status=200 ct=${ct}`)
      } else {
        finish('transient', `status=${res.statusCode}`)
      }
      res.resume()
    })
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      finish('transient', 'timeout')
    })
    req.on('error', (e) =>
      finish('transient', `err:${(e as NodeJS.ErrnoException).code ?? e.message}`),
    )
    req.end()
  })
}

async function probeWithConcurrency(
  urls: string[],
  limit: number,
): Promise<Map<string, ProbeOutcome>> {
  const out = new Map<string, ProbeOutcome>()
  let i = 0
  async function worker() {
    while (i < urls.length) {
      const idx = i++
      const u = urls[idx]
      out.set(u, await headProbe(u))
    }
  }
  const workers = Array.from({ length: Math.min(limit, urls.length) }, () => worker())
  await Promise.all(workers)
  return out
}

async function filterToValidImages(urls: string[]): Promise<Set<string>> {
  const now = Date.now()
  // The placeholder/expired-id problem is specific to lh3.googleusercontent.com.
  // Anything else (Supabase Storage, local /artworks/*, etc.) is trusted.
  const PROBE_HOSTS = ['lh3.googleusercontent.com']
  const needsProbe = (u: string) => PROBE_HOSTS.some((h) => u.includes(h))
  // Only re-probe URLs we haven't checked recently AND don't already know are valid.
  // Transient failures (timeouts, 5xx) aren't cached, so they get re-probed.
  const toProbe = urls.filter((u) => {
    if (!needsProbe(u)) return false
    const c = URL_VALIDITY.get(u)
    return !c || now - c.checkedAt > VALIDITY_TTL_MS
  })
  if (toProbe.length > 0) {
    const outcomes = await probeWithConcurrency(toProbe, 8)
    for (const [u, o] of outcomes) {
      if (o === 'transient') continue // don't poison the cache with transient failures
      URL_VALIDITY.set(u, { ok: o === 'ok', checkedAt: now })
    }
  }
  const valid = new Set<string>()
  for (const url of urls) {
    if (!needsProbe(url)) {
      valid.add(url)
      continue
    }
    const c = URL_VALIDITY.get(url)
    // If we never got a conclusive answer (every probe was transient), let it
    // through — the browser may succeed where our server probe didn't.
    if (!c || c.ok) valid.add(url)
  }
  return valid
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 0, 1), 500) : 200

    let query = supabase
      .from('artworks')
      .select(SELECT_COLUMNS)
      .not('image_url', 'is', null)
      .not('title', 'is', null)
      .neq('title', '')
      .order('title', { ascending: true })
      .limit(limit)

    if (category && category !== 'all') {
      query = query.ilike('period', category)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    // The scraper assigned the same image URL to many rows during ingest
    // (one URL backs 26 artworks, another backs 20, etc.). Dedupe so each
    // card shows a unique image-artwork pairing.
    const rawArtworks = (data ?? []) as Artwork[]
    const seen = new Set<string>()
    const candidates: Artwork[] = []
    for (const row of rawArtworks) {
      const normalized = normalizeImageUrl(row.image_url)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      candidates.push({ ...row, image_url: normalized })
    }

    const validUrls = await filterToValidImages(
      candidates.map((a) => a.image_url!).filter(Boolean),
    )
    const artworks = candidates.filter(
      (a) => a.image_url && validUrls.has(a.image_url),
    )

    // Category counts come from the deduped + validated set so the filter
    // dropdown numbers match what the gallery actually renders.
    const { data: countRows, error: periodErr } = await supabase
      .from('artworks')
      .select('image_url, period')
      .not('image_url', 'is', null)
      .not('title', 'is', null)
      .neq('title', '')
    if (periodErr) {
      throw new Error(periodErr.message)
    }

    const seenForCount = new Set<string>()
    const candidateForCount: Array<{ url: string; period: string | null }> = []
    for (const row of countRows ?? []) {
      const r = row as { image_url: string | null; period: string | null }
      const url = normalizeImageUrl(r.image_url)
      if (!url || seenForCount.has(url)) continue
      seenForCount.add(url)
      candidateForCount.push({ url, period: r.period })
    }
    const validCountUrls = await filterToValidImages(
      candidateForCount.map((c) => c.url),
    )
    const counts = new Map<string, number>()
    let totalUnique = 0
    for (const c of candidateForCount) {
      if (!validCountUrls.has(c.url)) continue
      totalUnique += 1
      const p = c.period?.trim()
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
    }

    const categories = [
      { id: 'all', label: 'All works', count: totalUnique },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ id: label, label, count })),
    ]

    return NextResponse.json({ artworks, categories })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/artworks] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
