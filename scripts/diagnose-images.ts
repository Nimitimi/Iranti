import { config } from 'dotenv'
import { resolve } from 'path'
import { setDefaultResultOrder } from 'node:dns'
import { request as httpsRequest } from 'node:https'
import { createClient } from '@supabase/supabase-js'

setDefaultResultOrder('ipv4first')
config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Probe = 'ok' | 'placeholder' | 'http-error'

function probe(url: string): Promise<Probe> {
  return new Promise((res) => {
    let done = false
    const finish = (p: Probe) => {
      if (!done) {
        done = true
        res(p)
      }
    }
    const r = httpsRequest(url, { method: 'HEAD' }, (resp) => {
      const ct = resp.headers['content-type'] ?? ''
      if (resp.statusCode === 200 && ct.includes('image/png')) finish('placeholder')
      else if (resp.statusCode === 200) finish('ok')
      else finish('http-error')
      resp.resume()
    })
    r.setTimeout(8000, () => {
      r.destroy()
      finish('http-error')
    })
    r.on('error', () => finish('http-error'))
    r.end()
  })
}

async function main() {
  const { data, error } = await supabase
    .from('artworks')
    .select('id, title, image_url, source_url')
    .order('title')
  if (error) throw error
  const rows = (data ?? []) as {
    id: string
    title: string | null
    image_url: string | null
    source_url: string | null
  }[]

  console.log(`Total rows in Supabase: ${rows.length}`)
  const withImg = rows.filter((r) => r.image_url && r.image_url.trim())
  console.log(`Rows with image_url set: ${withImg.length}`)

  const onStorage = withImg.filter((r) => r.image_url!.includes('/storage/v1/object/public/'))
  const onGoogle = withImg.filter((r) => r.image_url!.includes('googleusercontent.com'))
  console.log(`  on Supabase Storage: ${onStorage.length}`)
  console.log(`  on Google CDN:       ${onGoogle.length}`)

  const distinct = new Set(withImg.map((r) => r.image_url))
  console.log(`Distinct image_urls: ${distinct.size}`)

  const counts = new Map<string, number>()
  for (const r of withImg) counts.set(r.image_url!, (counts.get(r.image_url!) ?? 0) + 1)
  const shared = [...counts.entries()].filter(([, n]) => n > 1)
  console.log(
    `Image URLs shared by >1 artwork: ${shared.length} (covering ${shared.reduce((a, [, n]) => a + n, 0)} artworks)`,
  )

  const noSource = rows.filter((r) => !r.source_url || !r.source_url.trim())
  console.log(`Rows with NO source_url (unrecoverable from A&C): ${noSource.length}`)

  console.log(`\nProbing distinct Google-hosted URLs for validity...`)
  let ok = 0,
    bad = 0
  const seen = new Set<string>()
  for (const r of onGoogle) {
    if (seen.has(r.image_url!)) continue
    seen.add(r.image_url!)
    const p = await probe(r.image_url!)
    if (p === 'ok') ok++
    else bad++
  }
  console.log(`  distinct Google URLs probed: ${seen.size}`)
  console.log(`  ok: ${ok}   broken/placeholder: ${bad}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
