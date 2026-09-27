// localStorage can be missing or throw (private mode, blocked storage,
// sandboxed frames). Every access goes through here and fails soft.

const PREFIX = 'knightline:v1:'

/** The raw localStorage key, for matching storage events from other tabs. */
export function storageKey(key: string): string {
  return PREFIX + key
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // ignore: progress just won't persist
  }
}

export function remove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

export function clearAll(): void {
  try {
    const ls = globalThis.localStorage
    if (!ls) return
    const keys: string[] = []
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => ls.removeItem(k))
  } catch {
    // ignore
  }
}
