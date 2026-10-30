import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [drag, setDrag] = useState(0)
  const [keyboard, setKeyboard] = useState(0)
  const dragStart = useRef(0)
  const dragRef = useRef(0)
  const dragging = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timeout = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => {
      setKeyboard(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
      setKeyboard(0)
    }
  }, [open])

  useEffect(() => {
    if (!open || !mounted) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const frame = requestAnimationFrame(() => dialog?.focus())
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null

    function focusable() {
      if (!dialog) return []
      return [...dialog.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter(
        (element) => !element.hasAttribute('disabled'),
      )
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      root?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      previousFocus?.focus()
    }
  }, [open, mounted])

  if (!mounted) return null

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = true
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    const next = Math.max(0, event.clientY - dragStart.current)
    dragRef.current = next
    setDrag(next)
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    if (dragRef.current > 72) onCloseRef.current()
    dragRef.current = 0
    setDrag(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Cerrar"
        className={`sheet-motion absolute inset-0 bg-[#202808]/45 transition-opacity duration-300 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`sheet-motion absolute inset-x-0 mx-auto flex max-h-[min(86dvh,760px)] w-full max-w-[430px] flex-col rounded-t-[32px] bg-card shadow-card outline-none transition-transform duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          bottom: keyboard,
          ...(drag > 0 ? { transform: `translateY(${drag}px)` } : {}),
        }}
      >
        <div
          className="flex touch-none justify-center pb-1 pt-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1.5 w-12 rounded-full bg-[#E8DCCB]" aria-hidden="true" />
        </div>
        <h2 id={titleId} className="px-5 pb-2 font-display text-xl font-semibold">
          {title}
        </h2>
        <div className={`overflow-y-auto px-5 ${footer ? 'pb-3' : 'pb-6'}`}>{children}</div>
        {footer ? <div className="mt-auto border-t border-line px-5 pb-6 pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
