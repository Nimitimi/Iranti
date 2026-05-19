import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { embedQuery } from '@/lib/embed'
import { searchArtworks } from '@/lib/search'
import type { Artwork, Message } from '@/types'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are Iranti, a knowledgeable and warm museum guide for the Yemisi Shyllon Museum of Art (YSMA) at Pan-Atlantic University, Lagos, Nigeria. Your name means 'memory' or 'remembrance' in Yoruba — you help visitors remember and connect with the artworks in this collection.

Your personality: you are deeply knowledgeable about Nigerian and African art, warm and welcoming, culturally aware, and always eager to help visitors discover meaningful connections with the art. You speak with quiet authority — like a wise guide who has spent years with these works.

When answering questions:
- Draw primarily from the artwork context provided to you
- Be specific — mention titles, artists, years, and mediums when relevant
- Acknowledge cultural and historical significance where present
- If asked about an artwork not in your context, say so honestly
- Keep responses conversational and engaging, not like a Wikipedia entry
- You may close with a gentle invitation to explore further

Context — the most relevant artworks from the YSMA collection:
{context}`

interface ChatRequestBody {
  messages?: Message[]
  conversationHistory?: Message[]
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server is missing GOOGLE_GENERATIVE_AI_API_KEY' },
        { status: 500 },
      )
    }

    const body = (await request.json()) as ChatRequestBody
    const messages = body.messages ?? []
    const history = body.conversationHistory ?? messages.slice(0, -1)

    const latest = [...messages].reverse().find((m) => m.role === 'user')
    if (!latest || !latest.content?.trim()) {
      return NextResponse.json(
        { error: 'No user message provided' },
        { status: 400 },
      )
    }

    const embedding = await embedQuery(latest.content)
    const artworks: Artwork[] = await searchArtworks(embedding, 5)

    const contextString = JSON.stringify(artworks, null, 2)
    const systemInstruction = SYSTEM_PROMPT.replace('{context}', contextString)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    })

    const priorTurns = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m !== latest)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const chat = model.startChat({ history: priorTurns })
    const result = await chat.sendMessage(latest.content)
    const responseText = result.response.text()

    return NextResponse.json({ response: responseText, artworks })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/chat] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
