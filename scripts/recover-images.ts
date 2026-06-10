import { config } from 'dotenv'
import { resolve } from 'path'
import { setDefaultResultOrder } from 'node:dns'
import { createClient } from '@supabase/supabase-js'

// Match lib/supabase.ts: undici fetch stalls on IPv6 to Supabase from Windows.
setDefaultResultOrder('ipv4first')
config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env — need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const BUCKET = 'artwork-images'
const CONCURRENCY = 4
const FETCH_TIMEOUT_MS = 45_000
const PLACEHOLDER_MAX_BYTES = 60_000
const APPLY = process.argv.includes('--apply')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type Row = { id: string; title: string | null; image_url: string | null; source_url: string | null }

function timeoutFetch(url: string, init?: RequestInit) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA } }).finally(() =>
    clearTimeout(timer),
  )
}

// Google Arts & Culture asset pages expose the full per-artwork image via the
// og:image meta tag. For real artworks it's an lh*.googleusercontent.com URL;
// for video/tour assets it points at a YouTube thumbnail (i*.ytimg.com), which
// we treat as "not an image".
function extractImageBase(html: string): string | null {
  const og = html.match(/<meta property="og:image" content="([^"]+)"/)
  if (!og) return null
  const url = og[1]
  return url.includes('googleusercontent.com') ? url : null
}

function highRes(url: string): string {
  const eq = url.indexOf('=')
  const base = eq === -1 ? url : url.slice(0, eq)
  return `${base}=s1600`
}

type Outcome =
  | { status: 'recovered'; publicUrl: string }
  | { status: 'skip-storage' }
  | { status: 'hidden'; reason: string }
  | { status: 'err'; reason: string }

async function processOne(row: Row): Promise<Outcome> {
  // Already migrated to our own storage — leave it alone.
  if (row.image_url && row.image_url.includes('/storage/v1/object/public/')) {
    return { status: 'skip-storage' }
  }
  if (!row.source_url) return { status: 'hidden', reason: 'no source_url' }

  // 1. Pull the asset page and find the real per-artwork image.
  let html: string
  try {
    const page = await timeoutFetch(row.source_url)
    if (!page.ok) return { status: 'hidden', reason: `page http ${page.status}` }
    html = await page.text()
  } catch (e) {
    return { status: 'err', reason: `page fetch: ${(e as Error).message}` }
  }

  const base = extractImageBase(html)
  if (!base) return { status: 'hidden', reason: 'non-artwork (video/no image)' }

  // 2. Download the high-res image and verify it's real (not a placeholder PNG).
  let bytes: Buffer
  let contentType: string
  try {
    const img = await timeoutFetch(highRes(base))
    if (!img.ok) return { status: 'hidden', reason: `image http ${img.status}` }
    contentType = img.headers.get('content-type') ?? ''
    bytes = Buffer.from(await img.arrayBuffer())
  } catch (e) {
    return { status: 'err', reason: `image fetch: ${(e as Error).message}` }
  }
  if (contentType.includes('image/png') && bytes.byteLength <= PLACEHOLDER_MAX_BYTES) {
    return { status: 'hidden', reason: `placeholder png ${bytes.byteLength}b` }
  }
  if (!contentType.startsWith('image/')) {
    return { status: 'hidden', reason: `non-image ct=${contentType}` }
  }

  if (!APPLY) {
    return { status: 'recovered', publicUrl: `(dry-run, ${(bytes.byteLength / 1024).toFixed(0)}KB ${contentType})` }
  }

  // 3. Upload to our bucket and repoint image_url.
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const path = `${row.id}.${ext}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true })
  if (upErr) return { status: 'err', reason: `upload: ${upErr.message}` }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const { error: updErr } = await supabase.from('artworks').update({ image_url: pub.publicUrl }).eq('id', row.id)
  if (updErr) return { status: 'err', reason: `update: ${updErr.message}` }
  return { status: 'recovered', publicUrl: pub.publicUrl }
}

async function hide(row: Row): Promise<void> {
  // Keep the record + metadata, but null the image so /api/artworks excludes it
  // from the gallery (the route filters `.not('image_url','is',null)`).
  if (!APPLY) return
  await supabase.from('artworks').update({ image_url: null }).eq('id', row.id)
}

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 15 * 1024 * 1024,
  })
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`createBucket failed: ${error.message}`)
  }
}

async function main() {
  console.log(APPLY ? '*** APPLY mode — will write to Supabase ***\n' : '--- DRY RUN (pass --apply to write) ---\n')
  if (APPLY) await ensureBucket()

  // Every row that isn't already on our own storage is a recovery candidate.
  const { data, error } = await supabase
    .from('artworks')
    .select('id, title, image_url, source_url')
    .order('title')
  if (error) throw error
  const all = (data ?? []) as Row[]
  const rows = all.filter((r) => !(r.image_url && r.image_url.includes('/storage/v1/object/public/')))
  console.log(`${all.length} artworks total; ${rows.length} candidates to recover (rest already on storage)\n`)

  let i = 0
  const counts = { recovered: 0, hidden: 0, err: 0, 'skip-storage': 0 }
  const hiddenList: { title: string | null; reason: string }[] = []
  const errList: { id: string; reason: string }[] = []

  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= rows.length) return
      const row = rows[idx]
      const r = await processOne(row)
      counts[r.status]++
      const title = (row.title ?? '(untitled)').slice(0, 38).padEnd(38)
      if (r.status === 'recovered') {
        console.log(`[${String(idx + 1).padStart(3)}/${rows.length}] OK     ${title} ${r.publicUrl.slice(-48)}`)
      } else if (r.status === 'hidden') {
        console.log(`[${String(idx + 1).padStart(3)}/${rows.length}] HIDE   ${title} ${r.reason}`)
        hiddenList.push({ title: row.title, reason: r.reason })
        await hide(row)
      } else if (r.status === 'err') {
        console.log(`[${String(idx + 1).padStart(3)}/${rows.length}] ERR    ${title} ${r.reason}`)
        errList.push({ id: row.id, reason: r.reason })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log('\n=== Summary ===')
  console.log(`recovered:    ${counts.recovered}`)
  console.log(`hidden:       ${counts.hidden}`)
  console.log(`errors:       ${counts.err}`)
  if (hiddenList.length) {
    console.log('\nHidden (kept in DB, excluded from gallery):')
    for (const h of hiddenList) console.log(`  ${(h.title ?? '?').slice(0, 40).padEnd(40)} — ${h.reason}`)
  }
  if (errList.length) {
    console.log('\nErrors (transient — safe to re-run):')
    for (const e of errList) console.log(`  ${e.id}: ${e.reason}`)
  }
  if (!APPLY) console.log('\nDry run only. Re-run with --apply to write changes.')
}

main().catch((e) => {
  console.error('\nFATAL:', e)
  process.exit(1)
})
