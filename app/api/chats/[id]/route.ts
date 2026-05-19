import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anonCookieHeader, getOrCreateAnonUserId } from '@/lib/anon-user'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { id: anonUserId, setCookie } = getOrCreateAnonUserId()

  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id, title, anon_user_id, updated_at')
    .eq('id', params.id)
    .maybeSingle()

  if (chatError) {
    return NextResponse.json({ error: chatError.message }, { status: 500 })
  }
  if (!chat || chat.anon_user_id !== anonUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true })

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  const res = NextResponse.json({
    chat: { id: chat.id, title: chat.title, updated_at: chat.updated_at },
    messages: messages ?? [],
  })
  if (setCookie) res.headers.set('Set-Cookie', anonCookieHeader(anonUserId))
  return res
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { id: anonUserId } = getOrCreateAnonUserId()

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', params.id)
    .eq('anon_user_id', anonUserId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
