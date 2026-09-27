// Web haptics where supported (Android). iOS web has none; the Capacitor build
// can swap this for @capacitor/haptics.

let enabled = true

export function setHapticsEnabled(on: boolean) {
  enabled = on
}

export const hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function vibrate(pattern: number | number[]) {
  if (!enabled || !hapticsSupported) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}

export const haptic = {
  jump: () => vibrate(8),
  waypoint: () => vibrate([10, 30, 10]),
  error: () => vibrate([30, 40, 30]),
  win: () => vibrate([15, 40, 15, 40, 40]),
}
