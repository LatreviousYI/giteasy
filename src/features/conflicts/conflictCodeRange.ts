import type { ConflictBlockState } from './conflictSessions'

export type ConflictCodeSide = 'ours' | 'theirs' | 'base'

export interface ConflictCodeRange {
  startLine: number
  endLine: number
}

function blockText(block: ConflictBlockState, side: ConflictCodeSide): string | null {
  if (side === 'ours') return block.original.ours
  if (side === 'theirs') return block.original.theirs
  return block.original.base
}

export function findConflictCodeRange(
  fullText: string,
  blocks: ConflictBlockState[],
  currentBlock: number,
  side: ConflictCodeSide
): ConflictCodeRange | null {
  if (currentBlock < 0 || currentBlock >= blocks.length) return null
  let searchFrom = 0

  for (let index = 0; index <= currentBlock; index += 1) {
    const text = blockText(blocks[index], side)
    if (text === null) {
      if (index === currentBlock) return null
      continue
    }
    if (text.length === 0) {
      if (index === currentBlock) return null
      continue
    }
    const offset = fullText.indexOf(text, searchFrom)
    if (offset < 0) {
      if (index === currentBlock) return null
      continue
    }
    if (index === currentBlock) {
      const startLine = fullText.slice(0, offset).split('\n').length - 1
      return {
        startLine,
        endLine: startLine + text.split('\n').length - 1
      }
    }
    searchFrom = offset + text.length
  }

  return null
}
