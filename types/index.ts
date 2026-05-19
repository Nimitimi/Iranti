export interface Artwork {
  id: string
  title: string
  artist: string | null
  year: string | null
  medium: string | null
  description: string | null
  artist_bio: string | null
  location: string | null
  period: string | null
  provenance: string | null
  image_url: string | null
  source_url: string | null
  created_at?: string
  similarity?: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface FollowUpSuggestions {
  suggestions: string[]
}

export interface ChatState {
  conversationStarted: boolean
  currentArtwork: Artwork | null
  artworkPanelOpen: boolean
}

export interface CategoryDef {
  id: string
  label: string
  count: number
}

export interface Work {
  id: string
  title: string
  maker: string
  date: string
  tag?: string
  img?: string
  span?: 'feature' | 'wide'
}

export interface PromptPill {
  text: string
  arrow?: boolean
}
