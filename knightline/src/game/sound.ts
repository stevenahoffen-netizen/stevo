// Tiny synthesized sound set (no audio files). Browsers only allow audio after
// a user gesture; every call happens inside a tap handler.

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean) {
  enabled = on
}

function audio(): AudioContext | null {
  if (!enabled) return null
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'triangle') {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** A wooden "tock" that rises gently as the route fills. */
export function playJump(progress: number) {
  tone(330 + progress * 330, 0, 0.09, 0.12)
  tone(165 + progress * 165, 0, 0.05, 0.05, 'sine')
}

export function playWaypoint() {
  tone(660, 0, 0.14, 0.1)
  tone(990, 0.07, 0.2, 0.08)
}

export function playError() {
  tone(140, 0, 0.12, 0.1, 'sine')
}

export function playUndo() {
  tone(260, 0, 0.06, 0.06, 'sine')
}

export function playWin() {
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.09))
}
