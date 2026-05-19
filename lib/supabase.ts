import { setDefaultResultOrder } from 'node:dns'
import { createClient } from '@supabase/supabase-js'

// Windows + Node 20 undici fetch stalls on IPv6 routes to Cloudflare-fronted
// Supabase hosts; force IPv4 resolution so the first RPC doesn't time out.
setDefaultResultOrder('ipv4first')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

const key = serviceKey || anonKey
if (!key) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Next.js 14 wraps `fetch` and caches by default. supabase-js calls fetch
// internally, so without this override the dev server serves stale query
// results forever (e.g. after we re-point image_url to Supabase Storage,
// the API kept returning the old Google CDN URLs).
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
})
