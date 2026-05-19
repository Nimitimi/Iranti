import { config } from 'dotenv'
import { resolve } from 'path'
import { setDefaultResultOrder } from 'node:dns'
import { createClient } from '@supabase/supabase-js'

setDefaultResultOrder('ipv4first')
config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function main() {
  // Same query the API runs — ordered by title — see what the first 5 rows are
  const { data, error } = await supabase
    .from('artworks')
    .select('id, title, image_url')
    .not('image_url', 'is', null)
    .not('title', 'is', null)
    .neq('title', '')
    .order('title', { ascending: true })
    .limit(10)
  if (error) {
    console.error(error)
    return
  }
  for (const r of data ?? []) {
    const host = r.image_url ? new URL(r.image_url).hostname : '(null)'
    console.log(`${r.title?.slice(0, 30).padEnd(30)} ${r.id}  [${host}]`)
  }

  console.log('\n--- rows with title "Abenugongo" ---')
  const { data: ab } = await supabase
    .from('artworks')
    .select('id, title, image_url')
    .eq('title', 'Abenugongo')
  for (const r of ab ?? []) {
    console.log(`  ${r.id}  ${r.image_url?.slice(0, 80)}`)
  }
}

main().catch(console.error)
