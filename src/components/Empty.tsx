import type { ReactNode } from 'react'

export function Empty({
  icon,
  title,
  subtitle,
  action
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {subtitle && <div className="empty-sub">{subtitle}</div>}
      {action}
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" />
}
