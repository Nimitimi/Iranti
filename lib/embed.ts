const EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'

export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY')
  }

  const response = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Embedding request failed (${response.status}): ${detail}`)
  }

  const data = (await response.json()) as { embedding?: { values?: number[] } }
  const values = data.embedding?.values
  if (!values || !Array.isArray(values)) {
    throw new Error('Embedding response did not include values')
  }
  return values
}
