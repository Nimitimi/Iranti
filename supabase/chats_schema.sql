-- Run once in the Supabase SQL editor.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  anon_user_id text not null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_anon_user_updated_idx
  on public.chats (anon_user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_created_idx
  on public.chat_messages (chat_id, created_at);
