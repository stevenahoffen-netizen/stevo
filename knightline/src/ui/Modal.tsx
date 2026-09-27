import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconClose } from './icons'

// Open dialogs, innermost last: only the topmost one reacts to Escape and Tab.
const stack: symbol[] = []

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select, textarea'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose(): void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Parents pass a fresh onClose each render; keep the effect stable so focus
  // isn't reset whenever the parent re-renders.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const token = Symbol('modal')
    stack.push(token)
    const prev = document.activeElement as HTMLElement | null
    const first =
      ref.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      ref.current?.querySelector<HTMLElement>(`.sheet-body :is(${FOCUSABLE})`) ??
      ref.current?.querySelector<HTMLElement>('button')
    first?.focus({ preventScroll: true })
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (!items.length) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(token)
      if (i >= 0) stack.splice(i, 1)
      prev?.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'sheet wide' : 'sheet'} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function anyModalOpen(): boolean {
  return stack.length > 0
}
