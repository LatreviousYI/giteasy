import type { PullMode, PullStrategy, StatusDto } from './types'

export function effectivePullMode(
  requested: PullMode,
  saved: PullStrategy | null | undefined
): PullMode {
  return requested === 'auto' && saved ? saved : requested
}

export function isDiverged(status: Pick<StatusDto, 'ahead' | 'behind'>) {
  return status.ahead > 0 && status.behind > 0
}

export function pullModeLabel(mode: PullMode) {
  switch (mode) {
    case 'merge':
      return '合并'
    case 'rebase':
      return '变基'
    case 'ff-only':
      return '仅快进'
    default:
      return '自动'
  }
}
