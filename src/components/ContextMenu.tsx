import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clampContextMenuPosition } from '../lib/contextMenu'

interface ContextMenuSurfaceProps {
  x: number
  y: number
  className?: string
  onDismiss: () => void
  children: ReactNode
}

export function ContextMenuSurface({
  x,
  y,
  className = '',
  onDismiss,
  children
}: ContextMenuSurfaceProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0, ready: false })

  const updatePosition = useCallback(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const next = clampContextMenuPosition(x, y, rect.width, rect.height, {
      width: window.innerWidth,
      height: window.innerHeight
    })
    setPosition({ ...next, ready: true })
  }, [x, y])

  useLayoutEffect(() => {
    updatePosition()
  }, [updatePosition])

  useEffect(() => {
    const menu = menuRef.current
    const observer =
      menu && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null
    if (menu && observer) observer.observe(menu)
    window.addEventListener('resize', updatePosition)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        onMouseDown={onDismiss}
        onContextMenu={(event) => {
          event.preventDefault()
          onDismiss()
        }}
      />
      <div
        ref={menuRef}
        className={`context-menu-surface fixed z-50 rounded-[10px] p-1.5 ${className}`}
        role="menu"
        style={{
          left: position.x,
          top: position.y,
          visibility: position.ready ? 'visible' : 'hidden',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-pop)'
        }}
      >
        {children}
      </div>
    </>,
    document.body
  )
}

interface ContextMenuItemProps {
  children: ReactNode
  description?: string
  onClick?: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
}

export function ContextMenuItem({
  children,
  description,
  onClick,
  disabled,
  title,
  danger
}: ContextMenuItemProps) {
  return (
    <button
      className={`context-menu-item w-full text-left px-2.5 py-2 rounded-md text-[12px] disabled:opacity-45 disabled:cursor-not-allowed ${
        danger ? 'danger-text' : ''
      }`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className="block">{children}</span>
      {description && <span className="context-menu-description block">{description}</span>}
    </button>
  )
}

export function ContextMenuDivider() {
  return <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
}
