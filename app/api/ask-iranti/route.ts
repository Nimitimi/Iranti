import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/types'

export const runtime = 'nodejs'

const SYSTEM_TEMPLATE = `You are Iranti, a knowledgeable and warm museum guide for the Yemisi Shyllon Museum of Art (YSMA) at Pan-Atlantic University, Lagos, Nigeria. Your name means 'memory' or 'remembrance' in Yoruba — you help visitors remember and connect with the artworks in this collection.

You are currently in a focused, one-on-one conversation about a single artwork. Treat the artwork data below as your primary source of truth. You may draw on broader knowledge of African and Nigerian art history, but always tie answers back to this work or the wider YSMA collection. Never invent facts, dates, attributions, or quotes that are not supported. If the catalogue is silent on a question, say so honestly and offer a related thread the visitor might enjoy.

Tone: warm, conversational, editorial — like a curator walking with the visitor through the gallery. Not Wikipedia. Keep responses focused; one or two short paragraphs is usually enough unless asked for depth.

Artwork in focus:
{artwork}`

interface RequestBody {
  artworkId: string
  messages: Message[]
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

    const body = (await request.json()) as RequestBody
    const artworkId = body.artworkId
    const messages = body.messages ?? []

    if (!artworkId || messages.length === 0) {
      return NextResponse.json(
        { error: 'artworkId and messages are required' },
        { status: 400 },
      )
    }

    const latest = [...messages].reverse().find((m) => m.role === 'user')
    if (!latest || !latest.content?.trim()) {
      return NextResponse.json(
        { error: 'No user message provided' },
        { status: 400 },
      )
    }

    const { data: artwork, error: artErr } = await supabase
      .from('artworks')
      .select(
        'id, title, artist, year, medium, period, location, description, artist_bio, provenance',
      )
      .eq('id', artworkId)
      .single()
    if (artErr || !artwork) {
      return NextResponse.json(
        { error: 'Artwork not found' },
        { status: 404 },
      )
    }

    const systemInstruction = SYSTEM_TEMPLATE.replace(
      '{artwork}',
      JSON.stringify(artwork, null, 2),
    )

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    })

    // Gemini requires the chat history to begin with a 'user' turn. The
    // Ask Iranti page seeds the conversation with the artwork description as
    // an assistant message for display only — strip those leading assistant
    // turns before forwarding history. The artwork data is already in the
    // system instruction, so no context is lost.
    const conversational = messages
      .filter((m) => m !== latest)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
    const firstUserIdx = conversational.findIndex((m) => m.role === 'user')
    const trimmed = firstUserIdx === -1 ? [] : conversational.slice(firstUserIdx)
    const priorTurns = trimmed.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history: priorTurns })
    const result = await chat.sendMessage(latest.content)
    const responseText = result.response.text()

    return NextResponse.json({ response: responseText })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/ask-iranti] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
