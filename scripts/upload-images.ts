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
  throw new Error(
    'Missing env — need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const BUCKET = 'artwork-images'
const CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 45_000
// Google's "image ID invalid" placeholder is a fixed ~50 KB PNG. Real artworks
// come back as image/jpeg; treat any image/png from lh3 in that size band as
// dead and skip it.
const PLACEHOLDER_MAX_BYTES = 60_000

function normalizeImageUrl(url: string): string {
  if (!url.includes('lh3.googleusercontent.com')) return url
  const eq = url.indexOf('=')
  const base = eq === -1 ? url : url.slice(0, eq)
  return `${base}=s1600`
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

type Outcome =
  | { status: 'ok'; publicUrl: string }
  | { status: 'skip-already' }
  | { status: 'skip-dead'; reason: string }
  | { status: 'err'; reason: string }

async function downloadImage(
  url: string,
): Promise<{ bytes: Buffer; contentType: string } | { dead: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) return { dead: `http ${res.status}` }
    const ct = res.headers.get('content-type') ?? ''
    const ab = await res.arrayBuffer()
    const bytes = Buffer.from(ab)
    const isLh3 = url.includes('lh3.googleusercontent.com')
    if (isLh3 && ct.includes('image/png') && bytes.byteLength <= PLACEHOLDER_MAX_BYTES) {
      return { dead: `placeholder png ${bytes.byteLength}b` }
    }
    if (!ct.startsWith('image/')) return { dead: `non-image ct=${ct}` }
    return { bytes, contentType: ct }
  } catch (e) {
    return { dead: `fetch:${(e as Error).message}` }
  } finally {
    clearTimeout(timer)
  }
}

async function processOne(row: { id: string; image_url: string }): Promise<Outcome> {
  if (row.image_url.includes('/storage/v1/object/public/')) {
    return { status: 'skip-already' }
  }
  const url = normalizeImageUrl(row.image_url)
  const dl = await downloadImage(url)
  if ('dead' in dl) return { status: 'skip-dead', reason: dl.dead }

  const ext = dl.contentType.includes('png')
    ? 'png'
    : dl.contentType.includes('webp')
      ? 'webp'
      : 'jpg'
  const path = `${row.id}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, dl.bytes, { contentType: dl.contentType, upsert: true })
  if (upErr) return { status: 'err', reason: `upload: ${upErr.message}` }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const { error: updErr } = await supabase
    .from('artworks')
    .update({ image_url: pub.publicUrl })
    .eq('id', row.id)
  if (updErr) return { status: 'err', reason: `update: ${updErr.message}` }

  return { status: 'ok', publicUrl: pub.publicUrl }
}

async function main() {
  console.log(`Ensuring bucket "${BUCKET}" exists...`)
  await ensureBucket()

  const { data, error } = await supabase
    .from('artworks')
    .select('id, image_url')
    .not('image_url', 'is', null)
    .order('id')
  if (error) throw error
  const rows = (data ?? []) as { id: string; image_url: string }[]
  console.log(`Processing ${rows.length} artwork rows with ${CONCURRENCY} workers\n`)

  let i = 0
  const counts = { ok: 0, 'skip-already': 0, 'skip-dead': 0, err: 0 }
  const failures: Array<{ id: string; reason: string }> = []

  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= rows.length) return
      const row = rows[idx]
      const r = await processOne(row)
      counts[r.status]++
      const tag =
        r.status === 'ok'
          ? 'OK '
          : r.status === 'skip-already'
            ? 'AL '
            : r.status === 'skip-dead'
              ? 'DEAD'
              : 'ERR '
      const detail =
        r.status === 'skip-dead' || r.status === 'err' ? ` — ${r.reason}` : ''
      console.log(`[${String(idx + 1).padStart(3)}/${rows.length}] ${tag} ${row.id}${detail}`)
      if (r.status === 'err') failures.push({ id: row.id, reason: r.reason })
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log('\n=== Summary ===')
  console.log(`uploaded:     ${counts.ok}`)
  console.log(`already done: ${counts['skip-already']}`)
  console.log(`dead urls:    ${counts['skip-dead']}`)
  console.log(`errors:       ${counts.err}`)
  if (failures.length) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`  ${f.id}: ${f.reason}`)
  }
}

main().catch((e) => {
  console.error('\nFATAL:', e)
  process.exit(1)
})
