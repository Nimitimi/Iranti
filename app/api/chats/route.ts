import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { anonCookieHeader, getOrCreateAnonUserId } from '@/lib/anon-user'

export const runtime = 'nodejs'

export async function GET() {
  const { id: anonUserId, setCookie } = getOrCreateAnonUserId()

  const { data, error } = await supabase
    .from('chats')
    .select('id, title, updated_at')
    .eq('anon_user_id', anonUserId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const res = NextResponse.json({ chats: data ?? [] })
  if (setCookie) res.headers.set('Set-Cookie', anonCookieHeader(anonUserId))
  return res
}

export async function POST() {
  const { id: anonUserId, setCookie } = getOrCreateAnonUserId()

  const { data, error } = await supabase
    .from('chats')
    .insert({ anon_user_id: anonUserId })
    .select('id, title, updated_at')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create chat' },
      { status: 500 },
    )
  }

  const res = NextResponse.json({ chat: data })
  if (setCookie) res.headers.set('Set-Cookie', anonCookieHeader(anonUserId))
  return res
}
