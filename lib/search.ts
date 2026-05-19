import { supabase } from './supabase'
import type { Artwork } from '@/types'

export async function searchArtworks(
  embedding: number[],
  matchCount: number,
): Promise<Artwork[]> {
  const { data, error } = await supabase.rpc('match_artworks', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: matchCount,
  })

  if (error) {
    throw new Error(`match_artworks RPC failed: ${error.message}`)
  }

  return (data ?? []) as Artwork[]
}
