import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'
import { anonCookieHeader, getOrCreateAnonUserId } from '@/lib/anon-user'
import { embedQuery } from '@/lib/embed'
import { searchArtworks } from '@/lib/search'
import type { Artwork } from '@/types'

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

interface PostBody {
  content?: string
}

function deriveTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 60) return trimmed
  return trimmed.slice(0, 57).trimEnd() + '…'
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server is missing GOOGLE_GENERATIVE_AI_API_KEY' },
        { status: 500 },
      )
    }

    const body = (await request.json()) as PostBody
    const content = body.content?.trim()
    if (!content) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    const { id: anonUserId, setCookie } = getOrCreateAnonUserId()

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, title, anon_user_id')
      .eq('id', params.id)
      .maybeSingle()

    if (chatError) {
      return NextResponse.json({ error: chatError.message }, { status: 500 })
    }
    if (!chat || chat.anon_user_id !== anonUserId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: priorMessages, error: priorError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })

    if (priorError) {
      return NextResponse.json({ error: priorError.message }, { status: 500 })
    }

    const { error: insertUserError } = await supabase
      .from('chat_messages')
      .insert({ chat_id: chat.id, role: 'user', content })

    if (insertUserError) {
      return NextResponse.json(
        { error: insertUserError.message },
        { status: 500 },
      )
    }

    const embedding = await embedQuery(content)
    const artworks: Artwork[] = await searchArtworks(embedding, 5)
    const contextString = JSON.stringify(artworks, null, 2)
    const systemInstruction = SYSTEM_PROMPT.replace('{context}', contextString)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    })

    const history = (priorMessages ?? []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chatSession = model.startChat({ history })
    const result = await chatSession.sendMessage(content)
    const responseText = result.response.text()

    const isFirstUserMessage = !(priorMessages ?? []).some(
      (m) => m.role === 'user',
    )
    const nextTitle = isFirstUserMessage ? deriveTitle(content) : chat.title

    const { error: insertAssistantError } = await supabase
      .from('chat_messages')
      .insert({ chat_id: chat.id, role: 'assistant', content: responseText })

    if (insertAssistantError) {
      return NextResponse.json(
        { error: insertAssistantError.message },
        { status: 500 },
      )
    }

    const { data: updatedChat, error: updateError } = await supabase
      .from('chats')
      .update({ title: nextTitle, updated_at: new Date().toISOString() })
      .eq('id', chat.id)
      .select('id, title, updated_at')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const res = NextResponse.json({
      response: responseText,
      chat: updatedChat,
      artworks,
    })
    if (setCookie) res.headers.set('Set-Cookie', anonCookieHeader(anonUserId))
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/chats/[id]/messages] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
