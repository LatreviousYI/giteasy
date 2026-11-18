import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

const INITIAL_FOCUS_SELECTOR = [
  '[data-autofocus]',
  '[autofocus]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])'
].join(',')

const modalStack: string[] = []

export function useModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  modalId: string,
  onClose: () => void
) {
  const onCloseRef = useRef(onClose)
  const previousFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  )
  onCloseRef.current = onClose

  useEffect(() => {
    const previousFocus = previousFocusRef.current
    modalStack.push(modalId)
    const modal = containerRef.current
    const initialFocus = modal?.querySelector<HTMLElement>(INITIAL_FOCUS_SELECTOR) ?? modal
    initialFocus?.focus()

    const handler = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== modalId || !modal) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.tabIndex >= 0 && !element.hidden
      )
      if (focusable.length === 0) {
        event.preventDefault()
        modal.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (active === modal || !modal.contains(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => {
      window.removeEventListener('keydown', handler, true)
      const index = modalStack.lastIndexOf(modalId)
      if (index >= 0) modalStack.splice(index, 1)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [containerRef, modalId])
}
