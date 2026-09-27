// Optional product analytics. Sends events to PostHog's capture API only when
// VITE_POSTHOG_KEY is set at build time; otherwise every call is a no-op.
// An anonymous random id in local storage allows D1/D7 retention.

import { load, save } from './storage'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'

function anonId(): string {
  let id = load<string | null>('anon-id', null)
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    save('anon-id', id)
  }
  return id
}

export type EventName =
  | 'app_open'
  | 'puzzle_start'
  | 'first_move'
  | 'hint'
  | 'backtrack'
  | 'puzzle_complete'
  | 'share'
  | 'challenge_open'
  | 'tutorial_complete'

export function track(event: EventName, props: Record<string, string | number | boolean | undefined> = {}) {
  if (import.meta.env.DEV) console.debug('[track]', event, props)
  if (!KEY) return
  try {
    void fetch(`${HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, event, properties: { distinct_id: anonId(), ...props } }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}
