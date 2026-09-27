import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './icons'

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
  // Parents pass a fresh onClose each render; keep the effect stable so focus
  // isn't reset whenever the parent re-renders.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const first =
      ref.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      ref.current?.querySelector<HTMLElement>('.sheet-body button, .sheet-body [href], .sheet-body input') ??
      ref.current?.querySelector<HTMLElement>('button')
    first?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select')
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
      prev?.focus?.()
    }
  }, [])

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={wide ? 'sheet wide' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        ref={ref}
      >
        <header className="sheet-head">
          <h2 id="sheet-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
