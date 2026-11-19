import type { KeyboardEvent, PointerEvent } from 'react'
import {
  MAX_CONFLICT_VERSIONS_PERCENT,
  MIN_CONFLICT_VERSIONS_PERCENT,
  clampConflictVersionsPercent
} from './conflictPaneSize'

interface ConflictPaneSplitterProps {
  percent: number
  onChange: (percent: number) => void
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
}

export default function ConflictPaneSplitter({
  percent,
  onChange,
  onPointerDown
}: ConflictPaneSplitterProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null
    if (event.key === 'ArrowUp') next = percent - 2
    if (event.key === 'ArrowDown') next = percent + 2
    if (event.key === 'Home') next = MIN_CONFLICT_VERSIONS_PERCENT
    if (event.key === 'End') next = MAX_CONFLICT_VERSIONS_PERCENT
    if (next === null) return
    event.preventDefault()
    onChange(clampConflictVersionsPercent(next))
  }

  return (
    <div
      className="conflict-splitter"
      role="separator"
      aria-label="调整冲突版本区高度"
      aria-orientation="horizontal"
      aria-valuemin={MIN_CONFLICT_VERSIONS_PERCENT}
      aria-valuemax={MAX_CONFLICT_VERSIONS_PERCENT}
      aria-valuenow={Math.round(percent)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={handleKeyDown}
      title="拖动调整版本区高度，双击区域可聚焦后用上下键调整"
    />
  )
}
