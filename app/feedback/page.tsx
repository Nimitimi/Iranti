'use client'

import { Suspense, useState } from 'react'
import { Likert } from '@/components/Likert'
import { TopBar } from '@/components/TopBar'

type LikertKey =
  | 'engagement_1'
  | 'engagement_2'
  | 'engagement_3'
  | 'comprehension_1'
  | 'comprehension_2'
  | 'comprehension_3'
  | 'usability_1'
  | 'usability_2'

type FormState = {
  access_method: string
  used_before: string
  engagement_1: number | null
  engagement_2: number | null
  engagement_3: number | null
  comprehension_1: number | null
  comprehension_2: number | null
  comprehension_3: number | null
  usability_1: number | null
  usability_2: number | null
  memorable_moment: string
  suggestions: string
}

const INITIAL: FormState = {
  access_method: '',
  used_before: '',
  engagement_1: null,
  engagement_2: null,
  engagement_3: null,
  comprehension_1: null,
  comprehension_2: null,
  comprehension_3: null,
  usability_1: null,
  usability_2: null,
  memorable_moment: '',
  suggestions: '',
}

const LIKERT_KEYS: LikertKey[] = [
  'engagement_1',
  'engagement_2',
  'engagement_3',
  'comprehension_1',
  'comprehension_2',
  'comprehension_3',
  'usability_1',
  'usability_2',
]

export default function FeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackPageInner />
    </Suspense>
  )
}

function FeedbackPageInner() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const setLikert = (key: LikertKey) => (value: number) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  function missingRequired(): string | null {
    if (!form.access_method) return 'Please tell us how you accessed Iranti.'
    if (!form.used_before)
      return 'Please tell us whether you have used Iranti before.'
    for (const key of LIKERT_KEYS) {
      if (form[key] === null) return 'Please answer every rating question.'
    }
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const missing = missingRequired()
    if (missing) {
      setShowValidation(true)
      setError(missing)
      return
    }
    setShowValidation(false)
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_method: form.access_method,
          used_before: form.used_before,
          engagement_1: form.engagement_1,
          engagement_2: form.engagement_2,
          engagement_3: form.engagement_3,
          comprehension_1: form.comprehension_1,
          comprehension_2: form.comprehension_2,
          comprehension_3: form.comprehension_3,
          usability_1: form.usability_1,
          usability_2: form.usability_2,
          memorable_moment: form.memorable_moment.trim() || null,
          suggestions: form.suggestions.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Could not send feedback (${res.status})`)
      }
      setDone(true)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not send feedback.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page feedback-page">
      <TopBar />
      <main className="feedback-main">
        {done ? (
          <div className="feedback-thanks" role="status">
            <h1 className="feedback-thanks-title">Thank you.</h1>
            <p className="feedback-thanks-body">
              Your feedback has been recorded. It will directly shape how Iranti
              grows.
            </p>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={handleSubmit} noValidate>
            <header className="feedback-header">
              <h1 className="feedback-title">How was your visit with Iranti?</h1>
              <p className="feedback-sub">
                Your feedback helps improve this experience for every visitor to
                the Yemisi Shyllon Museum of Art. This takes about two minutes.
              </p>
            </header>

            <section className="feedback-section">
              <div className="feedback-section-label">About you</div>
              <div className="feedback-fields">
                <Field
                  label="How did you access Iranti today?"
                  required
                  invalid={showValidation && !form.access_method}
                >
                  <Select
                    value={form.access_method}
                    onChange={(v) =>
                      setForm((p) => ({ ...p, access_method: v }))
                    }
                    options={[
                      'On my phone',
                      'On a desktop/laptop',
                      'On a tablet',
                    ]}
                    placeholder="Select one"
                  />
                </Field>

                <Field
                  label="Have you used Iranti before?"
                  required
                  invalid={showValidation && !form.used_before}
                >
                  <Select
                    value={form.used_before}
                    onChange={(v) =>
                      setForm((p) => ({ ...p, used_before: v }))
                    }
                    options={[
                      'Yes, a few times',
                      'Yes, once before',
                      'No, this is my first time',
                    ]}
                    placeholder="Select one"
                  />
                </Field>
              </div>
            </section>

            <section className="feedback-section">
              <div className="feedback-section-label">Engagement</div>
              <div className="feedback-fields">
                <LikertField
                  label="Talking to Iranti made me want to ask more questions about the artworks than I would have otherwise."
                  invalid={showValidation && form.engagement_1 === null}
                >
                  <Likert
                    name="engagement_1"
                    value={form.engagement_1}
                    onChange={setLikert('engagement_1')}
                  />
                </LikertField>
                <LikertField
                  label="Iranti held my attention throughout our conversation."
                  invalid={showValidation && form.engagement_2 === null}
                >
                  <Likert
                    name="engagement_2"
                    value={form.engagement_2}
                    onChange={setLikert('engagement_2')}
                  />
                </LikertField>
                <LikertField
                  label="Talking to Iranti felt different from reading a wall label or exhibition caption."
                  invalid={showValidation && form.engagement_3 === null}
                >
                  <Likert
                    name="engagement_3"
                    value={form.engagement_3}
                    onChange={setLikert('engagement_3')}
                  />
                </LikertField>
              </div>
            </section>

            <section className="feedback-section">
              <div className="feedback-section-label">Comprehension</div>
              <div className="feedback-fields">
                <LikertField
                  label="After talking to Iranti, I understood the artwork better than I did before."
                  invalid={showValidation && form.comprehension_1 === null}
                >
                  <Likert
                    name="comprehension_1"
                    value={form.comprehension_1}
                    onChange={setLikert('comprehension_1')}
                  />
                </LikertField>
                <LikertField
                  label="Iranti was able to answer the questions I actually had about the artworks."
                  invalid={showValidation && form.comprehension_2 === null}
                >
                  <Likert
                    name="comprehension_2"
                    value={form.comprehension_2}
                    onChange={setLikert('comprehension_2')}
                  />
                </LikertField>
                <LikertField
                  label="Iranti's responses felt accurate and trustworthy."
                  invalid={showValidation && form.comprehension_3 === null}
                >
                  <Likert
                    name="comprehension_3"
                    value={form.comprehension_3}
                    onChange={setLikert('comprehension_3')}
                  />
                </LikertField>
              </div>
            </section>

            <section className="feedback-section">
              <div className="feedback-section-label">Usability</div>
              <div className="feedback-fields">
                <LikertField
                  label="The interface was easy to use."
                  invalid={showValidation && form.usability_1 === null}
                >
                  <Likert
                    name="usability_1"
                    value={form.usability_1}
                    onChange={setLikert('usability_1')}
                  />
                </LikertField>
                <LikertField
                  label="I would recommend Iranti to someone visiting the museum."
                  invalid={showValidation && form.usability_2 === null}
                >
                  <Likert
                    name="usability_2"
                    value={form.usability_2}
                    onChange={setLikert('usability_2')}
                  />
                </LikertField>
              </div>
            </section>

            <section className="feedback-section">
              <div className="feedback-section-label">Your words</div>
              <div className="feedback-fields">
                <Field
                  label="Was there a moment in your conversation with Iranti that stood out to you — something that surprised or moved you?"
                  optional
                >
                  <textarea
                    className="feedback-textarea"
                    rows={4}
                    placeholder="Describe it in your own words…"
                    value={form.memorable_moment}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        memorable_moment: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Is there anything Iranti should do differently?"
                  optional
                >
                  <textarea
                    className="feedback-textarea"
                    rows={4}
                    placeholder="Any thoughts are welcome…"
                    value={form.suggestions}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, suggestions: e.target.value }))
                    }
                  />
                </Field>
              </div>
            </section>

            <div className="feedback-submit-row">
              <button
                type="submit"
                className="feedback-submit"
                disabled={submitting}
              >
                {submitting ? 'Sending…' : 'Submit feedback'}
              </button>
              {error && <p className="feedback-error">{error}</p>}
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

function Field({
  label,
  required,
  optional,
  invalid,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`feedback-field${invalid ? ' is-invalid' : ''}`}>
      <label className="feedback-label">
        {label}
        {required && <span className="feedback-required" aria-hidden> *</span>}
        {optional && <span className="feedback-optional"> (optional)</span>}
      </label>
      {children}
    </div>
  )
}

function LikertField({
  label,
  invalid,
  children,
}: {
  label: string
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`feedback-field feedback-field-likert${invalid ? ' is-invalid' : ''}`}>
      <div className="feedback-label">{label}</div>
      {children}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <div className="feedback-select-wrap">
      <select
        className={`feedback-select${value ? '' : ' is-placeholder'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <svg
        className="feedback-select-caret"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}
