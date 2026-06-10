import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { embedQuery } from '@/lib/embed'
import { searchArtworks } from '@/lib/search'
import type { Artwork, Message } from '@/types'

export const runtime = 'nodejs'

// Vision chat: a visitor uploads or photographs an artwork and asks Iranti
// about it. Unlike /api/chats, this is stateless and not persisted — the image
// is sent with every request and nothing is written to the database.
const SYSTEM_PROMPT = `You are Iranti, a knowledgeable and warm museum guide for the Yemisi Shyllon Museum of Art (YSMA) at Pan-Atlantic University, Lagos, Nigeria. Your name means 'memory' or 'remembrance' in Yoruba.

A visitor has shared a photograph of an artwork or object and wants to learn about it. Look closely at the image and answer their questions.

How to respond:
- Describe what you actually see in the image — subject, materials, form, colour, style.
- Offer informed interpretation: likely region, tradition, period, medium, and cultural significance, drawing on your knowledge of Nigerian and African art.
- Be honest that you are interpreting a photograph, not reading a catalogue record. Never invent a specific title, artist, date, or provenance you cannot support — say when something is uncertain.
- Where it helps, connect the piece to the YSMA collection or to broader African art history.
- Warm, conversational, curatorial tone — like a guide looking at the piece alongside the visitor. One or two short paragraphs unless asked for more.

Related works from the YSMA collection that may be relevant (use only if genuinely connected):
{context}`

interface RequestBody {
  image?: { data: string; mimeType: string }
  messages?: Message[]
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server is missing GOOGLE_GENERATIVE_AI_API_KEY' },
        { status: 500 },
      )
    }

    const body = (await request.json()) as RequestBody
    const image = body.image
    const messages = body.messages ?? []

    if (!image?.data || !image.mimeType) {
      return NextResponse.json({ error: 'An image is required' }, { status: 400 })
    }
    if (!ALLOWED_MIME.includes(image.mimeType)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${image.mimeType}` },
        { status: 400 },
      )
    }

    const latest = [...messages].reverse().find((m) => m.role === 'user')
    if (!latest || !latest.content?.trim()) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    }

    // Light RAG: pull a few catalogue works related to the visitor's question
    // so Iranti can ground answers in the real collection where relevant. Best
    // effort — if embedding/search fails, we still answer from the image alone.
    let context = 'No specific catalogue matches — answer from the image and general knowledge.'
    try {
      const embedding = await embedQuery(latest.content)
      const related: Artwork[] = await searchArtworks(embedding, 3)
      if (related.length > 0) context = JSON.stringify(related, null, 2)
    } catch (e) {
      console.warn('[api/ask-image] RAG context skipped:', (e as Error).message)
    }

    const systemInstruction = SYSTEM_PROMPT.replace('{context}', context)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    })

    // Build the multimodal conversation. The image is attached to the first
    // user turn so it stays in context for the whole exchange.
    let imageAttached = false
    const contents = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        const role = m.role === 'assistant' ? 'model' : 'user'
        const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = []
        if (role === 'user' && !imageAttached) {
          parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } })
          imageAttached = true
        }
        parts.push({ text: m.content })
        return { role, parts }
      })

    const result = await model.generateContent({ contents })
    const responseText = result.response.text()

    return NextResponse.json({ response: responseText })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/ask-image] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
