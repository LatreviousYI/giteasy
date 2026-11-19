export const CONFLICT_PANE_STORAGE_KEY = 'giteasy.conflictMergeEditorPercent'
export const DEFAULT_CONFLICT_VERSIONS_PERCENT = 48
export const MIN_CONFLICT_VERSIONS_PERCENT = 18
export const MAX_CONFLICT_VERSIONS_PERCENT = 72

export function clampConflictVersionsPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONFLICT_VERSIONS_PERCENT
  return Math.min(MAX_CONFLICT_VERSIONS_PERCENT, Math.max(MIN_CONFLICT_VERSIONS_PERCENT, value))
}

export function readConflictVersionsPercent(value: string | null): number {
  if (value === null) return DEFAULT_CONFLICT_VERSIONS_PERCENT
  const parsed = Number(value)
  return clampConflictVersionsPercent(parsed)
}

export function resizeConflictVersionsPercent(
  startPercent: number,
  deltaY: number,
  containerHeight: number
): number {
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
    return clampConflictVersionsPercent(startPercent)
  }
  return clampConflictVersionsPercent(startPercent + (deltaY / containerHeight) * 100)
}
