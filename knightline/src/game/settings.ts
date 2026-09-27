import { load, save } from './storage'

export type ThemeChoice = 'system' | 'light' | 'dark'

export interface Settings {
  sound: boolean
  haptics: boolean
  showExits: boolean
  /** small move numbers on visited squares */
  showSteps: boolean
  theme: ThemeChoice
}

// Web daily puzzles are silent by default (NYT, LinkedIn); sound is opt-in.
export const DEFAULT_SETTINGS: Settings = { sound: false, haptics: true, showExits: false, showSteps: false, theme: 'system' }

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) }
}

export function saveSettings(s: Settings) {
  save('settings', s)
}

// A host page (e.g. an embedding frame) may already stamp a theme on <html>.
// "System" restores whatever was there instead of wiping it.
const hostTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null

export function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement
  if (theme !== 'system') root.setAttribute('data-theme', theme)
  else if (hostTheme) root.setAttribute('data-theme', hostTheme)
  else root.removeAttribute('data-theme')
}
