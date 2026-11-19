import {
  parseConflictBlocks,
  resolveAllConflictBlocks,
  resolveConflictBlock,
  type ConflictBlock,
  type ConflictChoice
} from '../../lib/conflict'

export type ConflictBlockStatus = 'unresolved' | ConflictChoice | 'custom'

export interface ConflictBlockState {
  id: string
  original: ConflictBlock
  status: ConflictBlockStatus
}

export interface ConflictSnapshot {
  content: string
  statuses: ConflictBlockStatus[]
  currentBlock: number
}

export interface ConflictFileSession {
  path: string
  content: string
  blocks: ConflictBlockState[]
  currentBlock: number
  undoStack: ConflictSnapshot[]
  editing: boolean
}

function createSnapshot(session: ConflictFileSession): ConflictSnapshot {
  return {
    content: session.content,
    statuses: session.blocks.map((block) => block.status),
    currentBlock: session.currentBlock
  }
}

function withSnapshot(session: ConflictFileSession): ConflictFileSession {
  return {
    ...session,
    editing: false,
    undoStack: [...session.undoStack, createSnapshot(session)]
  }
}

function reconcileStatuses(blocks: ConflictBlockState[], content: string): ConflictBlockState[] {
  const remaining = parseConflictBlocks(content).length
  const unresolved = blocks
    .map((block, index) => ({ block, index }))
    .filter((item) => item.block.status === 'unresolved')
  const keepUnresolved = Math.min(remaining, unresolved.length)

  return blocks.map((block, index) => {
    const unresolvedPosition = unresolved.findIndex((item) => item.index === index)
    if (unresolvedPosition < 0 || unresolvedPosition < keepUnresolved) return block
    return { ...block, status: 'custom' }
  })
}

function clampCurrentBlock(session: ConflictFileSession): number {
  if (session.blocks.length === 0) return 0
  return Math.max(0, Math.min(session.blocks.length - 1, session.currentBlock))
}

export function createConflictSession(path: string, content: string): ConflictFileSession {
  const blocks = parseConflictBlocks(content).map((block) => ({
    id: `conflict-${block.index}`,
    original: block,
    status: 'unresolved' as const
  }))
  return {
    path,
    content,
    blocks,
    currentBlock: 0,
    undoStack: [],
    editing: false
  }
}

export function unresolvedConflictCount(content: string): number {
  return parseConflictBlocks(content).length
}

export function allConflictBlocksResolved(session: ConflictFileSession): boolean {
  return unresolvedConflictCount(session.content) === 0
}

export function applyConflictChoice(
  session: ConflictFileSession,
  choice: ConflictChoice
): ConflictFileSession {
  const current = session.blocks[session.currentBlock]
  if (!current || current.status !== 'unresolved') return session

  const unresolved = session.blocks
    .map((block, index) => ({ block, index }))
    .filter((item) => item.block.status === 'unresolved')
  const position = unresolved.findIndex((item) => item.index === session.currentBlock)
  const parsed = parseConflictBlocks(session.content)[position]
  if (!parsed) return session

  const next = withSnapshot(session)
  const content = resolveConflictBlock(next.content, parsed.index, choice)
  return {
    ...next,
    content,
    blocks: next.blocks.map((block, index) =>
      index === session.currentBlock ? { ...block, status: choice } : block
    )
  }
}

export function applyAllConflictChoices(
  session: ConflictFileSession,
  choice: ConflictChoice
): ConflictFileSession {
  if (unresolvedConflictCount(session.content) === 0) return session
  const next = withSnapshot(session)
  return {
    ...next,
    content: resolveAllConflictBlocks(next.content, choice).text,
    blocks: next.blocks.map((block) =>
      block.status === 'unresolved' ? { ...block, status: choice } : block
    )
  }
}

export function updateConflictSessionContent(
  session: ConflictFileSession,
  content: string
): ConflictFileSession {
  if (content === session.content) return session
  return {
    ...session,
    content,
    blocks: reconcileStatuses(session.blocks, content),
    currentBlock: clampCurrentBlock(session)
  }
}

export function beginConflictEdit(session: ConflictFileSession): ConflictFileSession {
  if (session.editing) return session
  return { ...withSnapshot(session), editing: true }
}

export function endConflictEdit(session: ConflictFileSession): ConflictFileSession {
  return session.editing ? { ...session, editing: false } : session
}

export function undoConflictSession(session: ConflictFileSession): ConflictFileSession {
  const snapshot = session.undoStack.at(-1)
  if (!snapshot) return session
  return {
    ...session,
    content: snapshot.content,
    blocks: session.blocks.map((block, index) => ({
      ...block,
      status: snapshot.statuses[index] ?? block.status
    })),
    currentBlock: snapshot.currentBlock,
    undoStack: session.undoStack.slice(0, -1),
    editing: false
  }
}

export function navigateConflictBlock(
  session: ConflictFileSession,
  direction: 'previous' | 'next'
): ConflictFileSession {
  if (session.blocks.length === 0) return session
  const step = direction === 'next' ? 1 : -1
  const current = session.currentBlock

  for (let distance = 1; distance <= session.blocks.length; distance += 1) {
    const index = (current + step * distance + session.blocks.length) % session.blocks.length
    if (session.blocks[index].status === 'unresolved') {
      return { ...session, currentBlock: index }
    }
  }

  return {
    ...session,
    currentBlock: (current + step + session.blocks.length) % session.blocks.length
  }
}

export function selectConflictBlock(
  session: ConflictFileSession,
  index: number
): ConflictFileSession {
  if (index < 0 || index >= session.blocks.length || index === session.currentBlock) {
    return session
  }
  return { ...session, currentBlock: index }
}
