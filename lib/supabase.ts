import { setDefaultResultOrder } from 'node:dns'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Windows + Node 20 undici fetch stalls on IPv6 routes to Cloudflare-fronted
// Supabase hosts; force IPv4 resolution so the first RPC doesn't time out.
setDefaultResultOrder('ipv4first')

// The client is created lazily on first use rather than at module load. All
// consuming routes are `dynamic = 'force-dynamic'`, but Next.js still imports
// their modules during the build's "collect page data" step — and a
// module-level throw or createClient() there fails the build when env vars
// aren't present (e.g. Preview deployments). Deferring to first access keeps
// the build green and surfaces any missing-env error at request time instead.
let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client

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
  client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
  return client
}

// Proxy preserves the `import { supabase }` + `supabase.from(...)` call sites
// while routing every access through the lazy initializer above.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = getClient()
    const value = Reflect.get(c as object, prop, receiver)
    return typeof value === 'function' ? value.bind(c) : value
  },
})
