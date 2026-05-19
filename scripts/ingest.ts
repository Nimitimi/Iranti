import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase env vars missing — need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
}
if (!GOOGLE_API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is missing')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'

async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(`${EMBED_URL}?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Embedding request failed (${response.status}): ${detail}`)
  }
  const data = (await response.json()) as { embedding?: { values?: number[] } }
  const values = data.embedding?.values
  if (!values || !Array.isArray(values)) {
    throw new Error('Embedding response did not include values')
  }
  return values
}

interface ArtworkRow {
  id: string
  title: string | null
  artist: string | null
  year: string | null
  medium: string | null
  period: string | null
  location: string | null
  description: string | null
  artist_bio: string | null
  provenance: string | null
}

function buildEmbeddingText(row: ArtworkRow): string {
  const parts = [
    `Title: ${row.title ?? ''}`,
    `Artist: ${row.artist ?? ''}`,
    `Year: ${row.year ?? ''}`,
    `Medium: ${row.medium ?? ''}`,
    `Period: ${row.period ?? ''}`,
    `Location: ${row.location ?? ''}`,
    `Description: ${row.description ?? ''}`,
    `Artist Bio: ${row.artist_bio ?? ''}`,
    `Provenance: ${row.provenance ?? ''}`,
  ]
  return parts.join(' ')
}


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { data: rows, error } = await supabase
    .from('artworks')
    .select('id, title, artist, year, medium, period, location, description, artist_bio, provenance')
    .is('embedding', null)

  if (error) {
    throw new Error(`Failed to fetch artworks: ${error.message}`)
  }

  if (!rows || rows.length === 0) {
    console.log('No artworks need embedding. Done.')
    return
  }

  console.log(`Found ${rows.length} artwork(s) without embeddings.`)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as ArtworkRow
    const label = `[${i + 1}/${rows.length}] ${row.title ?? '(untitled)'}`
    try {
      const text = buildEmbeddingText(row)
      const embedding = await embedQuery(text)
      const { error: updateError } = await supabase
        .from('artworks')
        .update({ embedding })
        .eq('id', row.id)
      if (updateError) {
        throw new Error(updateError.message)
      }
      console.log(`${label} — done`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${label} — failed: ${message}`)
    }
    if (i < rows.length - 1) {
      await sleep(1000)
    }
  }

  console.log('Ingest complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
