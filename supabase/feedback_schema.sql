-- Run once in the Supabase SQL editor.

create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  access_method text,
  used_before text,
  engagement_1 integer,
  engagement_2 integer,
  engagement_3 integer,
  comprehension_1 integer,
  comprehension_2 integer,
  comprehension_3 integer,
  usability_1 integer,
  usability_2 integer,
  memorable_moment text,
  suggestions text
);

-- Inserts run from the server using the service role key, so RLS can stay
-- restrictive. If you ever swap the API route to the anon key, add an
-- explicit insert policy.
alter table public.feedback_responses enable row level security;
