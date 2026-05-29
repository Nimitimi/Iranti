import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

/*
  Run this in the Supabase SQL editor before deploying:

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

  -- Inserts run from the server using the service role key (see lib/supabase),
  -- so RLS can stay restrictive. If you flip to the anon key here, add an
  -- explicit insert policy.
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

const QUESTION_LABELS: Record<string, string> = {
  access_method: 'How did you access Iranti today?',
  used_before: 'Have you used Iranti before?',
  engagement_1:
    'Talking to Iranti made me want to ask more questions about the artworks than I would have otherwise.',
  engagement_2: 'Iranti held my attention throughout our conversation.',
  engagement_3:
    'Talking to Iranti felt different from reading a wall label or exhibition caption.',
  comprehension_1:
    'After talking to Iranti, I understood the artwork better than I did before.',
  comprehension_2:
    'Iranti was able to answer the questions I actually had about the artworks.',
  comprehension_3: "Iranti's responses felt accurate and trustworthy.",
  usability_1: 'The interface was easy to use.',
  usability_2: 'I would recommend Iranti to someone visiting the museum.',
  memorable_moment:
    'Was there a moment in your conversation with Iranti that stood out to you?',
  suggestions: 'Is there anything Iranti should do differently?',
}

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

function buildEmailBody(row: {
  created_at: string
  access_method: string
  used_before: string
  engagement_1: number
  engagement_2: number
  engagement_3: number
  comprehension_1: number
  comprehension_2: number
  comprehension_3: number
  usability_1: number
  usability_2: number
  memorable_moment: string | null
  suggestions: string | null
}) {
  const line = (label: string, value: string | number | null) =>
    `${label}\n${value ?? '—'}\n`

  const sections: string[] = []
  sections.push(`New Iranti feedback — ${row.created_at}`)
  sections.push('')
  sections.push('— About you —')
  sections.push(line(QUESTION_LABELS.access_method, row.access_method))
  sections.push(line(QUESTION_LABELS.used_before, row.used_before))
  sections.push('— Engagement (1–5) —')
  sections.push(line(QUESTION_LABELS.engagement_1, row.engagement_1))
  sections.push(line(QUESTION_LABELS.engagement_2, row.engagement_2))
  sections.push(line(QUESTION_LABELS.engagement_3, row.engagement_3))
  sections.push('— Comprehension (1–5) —')
  sections.push(line(QUESTION_LABELS.comprehension_1, row.comprehension_1))
  sections.push(line(QUESTION_LABELS.comprehension_2, row.comprehension_2))
  sections.push(line(QUESTION_LABELS.comprehension_3, row.comprehension_3))
  sections.push('— Usability (1–5) —')
  sections.push(line(QUESTION_LABELS.usability_1, row.usability_1))
  sections.push(line(QUESTION_LABELS.usability_2, row.usability_2))
  if (row.memorable_moment) {
    sections.push('— A moment that stood out —')
    sections.push(row.memorable_moment + '\n')
  }
  if (row.suggestions) {
    sections.push('— Suggestions —')
    sections.push(row.suggestions + '\n')
  }
  return sections.join('\n')
}

async function sendEmail(subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.FEEDBACK_EMAIL
  if (!apiKey || !to) {
    console.warn(
      '[api/feedback] Skipping email: RESEND_API_KEY or FEEDBACK_EMAIL not set',
    )
    return
  }
  const from = process.env.FEEDBACK_FROM_EMAIL || 'Iranti <onboarding@resend.dev>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${text}`)
  }
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

  const { data, error } = await supabase
    .from('feedback_responses')
    .insert(insertRow)
    .select('id, created_at')
    .single()

  if (error || !data) {
    console.error('[api/feedback] insert failed:', error?.message)
    return NextResponse.json(
      { error: 'Could not save your feedback. Please try again.' },
      { status: 500 },
    )
  }

  try {
    const body = buildEmailBody({
      created_at: data.created_at,
      access_method,
      used_before,
      ...likert,
      memorable_moment,
      suggestions,
    })
    await sendEmail('New Iranti feedback', body)
  } catch (err) {
    console.error('[api/feedback] email failed:', err)
    // Storage succeeded — don't fail the visitor's submission over a mail hiccup.
  }

  return NextResponse.json({ success: true })
}
