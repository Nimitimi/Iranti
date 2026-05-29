import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

/*
  Run this in the Supabase SQL editor before deploying (also in
  supabase/feedback_schema.sql):

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

  alter table public.feedback_responses enable row level security;
*/

type LikertField =
  | 'engagement_1'
  | 'engagement_2'
  | 'engagement_3'
  | 'comprehension_1'
  | 'comprehension_2'
  | 'comprehension_3'
  | 'usability_1'
  | 'usability_2'

const LIKERT_FIELDS: LikertField[] = [
  'engagement_1',
  'engagement_2',
  'engagement_3',
  'comprehension_1',
  'comprehension_2',
  'comprehension_3',
  'usability_1',
  'usability_2',
]

const ACCESS_OPTIONS = new Set([
  'On my phone',
  'On a desktop/laptop',
  'On a tablet',
])

const USED_BEFORE_OPTIONS = new Set([
  'Yes, a few times',
  'Yes, once before',
  'No, this is my first time',
])

interface FeedbackPayload {
  access_method?: unknown
  used_before?: unknown
  engagement_1?: unknown
  engagement_2?: unknown
  engagement_3?: unknown
  comprehension_1?: unknown
  comprehension_2?: unknown
  comprehension_3?: unknown
  usability_1?: unknown
  usability_2?: unknown
  memorable_moment?: unknown
  suggestions?: unknown
}

function asLikert(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 1 || value > 5) return null
  return value
}

function asText(value: unknown, max = 4000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export async function POST(request: Request) {
  let payload: FeedbackPayload
  try {
    payload = (await request.json()) as FeedbackPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const access_method = asText(payload.access_method, 80)
  const used_before = asText(payload.used_before, 80)
  if (!access_method || !ACCESS_OPTIONS.has(access_method)) {
    return NextResponse.json(
      { error: 'Please choose how you accessed Iranti today.' },
      { status: 400 },
    )
  }
  if (!used_before || !USED_BEFORE_OPTIONS.has(used_before)) {
    return NextResponse.json(
      { error: 'Please tell us whether you have used Iranti before.' },
      { status: 400 },
    )
  }

  const likert: Record<LikertField, number> = {} as Record<LikertField, number>
  for (const field of LIKERT_FIELDS) {
    const value = asLikert(payload[field])
    if (value === null) {
      return NextResponse.json(
        { error: 'Please answer every rating question (1–5).' },
        { status: 400 },
      )
    }
    likert[field] = value
  }

  const memorable_moment = asText(payload.memorable_moment)
  const suggestions = asText(payload.suggestions)

  const insertRow = {
    access_method,
    used_before,
    ...likert,
    memorable_moment,
    suggestions,
  }

  const { error } = await supabase
    .from('feedback_responses')
    .insert(insertRow)

  if (error) {
    console.error('[api/feedback] insert failed:', error.message)
    return NextResponse.json(
      { error: 'Could not save your feedback. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
