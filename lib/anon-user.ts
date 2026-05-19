import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'

const COOKIE_NAME = 'iranti_uid'
const ONE_YEAR = 60 * 60 * 24 * 365

export function getOrCreateAnonUserId(): { id: string; setCookie: boolean } {
  const store = cookies()
  const existing = store.get(COOKIE_NAME)?.value
  if (existing) return { id: existing, setCookie: false }
  return { id: randomUUID(), setCookie: true }
}

export function anonCookieHeader(id: string): string {
  const parts = [
    `${COOKIE_NAME}=${id}`,
    'Path=/',
    `Max-Age=${ONE_YEAR}`,
    'SameSite=Lax',
    'HttpOnly',
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}
