import type { ReactNode } from 'react'
import { clampContextMenuPosition } from '../lib/contextMenu'

interface ContextMenuSurfaceProps {
  x: number
  y: number
  width?: number
  estimatedHeight: number
  className?: string
  onDismiss: () => void
  children: ReactNode
}

export function ContextMenuSurface({
  x,
  y,
  width = 300,
  estimatedHeight,
  className = '',
  onDismiss,
  children
}: ContextMenuSurfaceProps) {
  const position = clampContextMenuPosition(x, y, width, estimatedHeight, {
    width: window.innerWidth,
    height: window.innerHeight
  })

  return (
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
        className={`context-menu-surface fixed z-50 rounded-[10px] p-1.5 ${className}`}
        style={{
          left: position.x,
          top: position.y,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-pop)'
        }}
      >
        {children}
      </div>
    </>
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
