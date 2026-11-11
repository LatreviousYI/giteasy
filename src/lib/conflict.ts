export interface ConflictBlock {
  index: number
  startLine: number
  endLine: number
  ours: string
  base: string | null
  theirs: string
}

export type ConflictChoice = 'ours' | 'theirs' | 'both'

/** 解析工作区文件中的冲突标记，兼容 merge 与 diff3 风格。 */
export function parseConflictBlocks(text: string): ConflictBlock[] {
  const lines = text.split('\n')
  const blocks: ConflictBlock[] = []
  let cursor = 0
  while (cursor < lines.length) {
    if (!lines[cursor].startsWith('<<<<<<<')) {
      cursor += 1
      continue
    }
    const startLine = cursor
    const ours: string[] = []
    const base: string[] = []
    let hasBase = false
    const theirs: string[] = []
    let section: 'ours' | 'base' | 'theirs' = 'ours'
    let endLine: number | null = null
    cursor += 1
    while (cursor < lines.length) {
      const line = lines[cursor]
      if (line.startsWith('|||||||')) {
        section = 'base'
        hasBase = true
        cursor += 1
        continue
      }
      if (line.startsWith('=======') && section !== 'theirs') {
        section = 'theirs'
        cursor += 1
        continue
      }
      if (line.startsWith('>>>>>>>')) {
        endLine = cursor
        cursor += 1
        break
      }
      if (section === 'ours') ours.push(line)
      else if (section === 'base') base.push(line)
      else theirs.push(line)
      cursor += 1
    }
    if (endLine === null) break
    blocks.push({
      index: blocks.length,
      startLine,
      endLine,
      ours: ours.join('\n'),
      base: hasBase ? base.join('\n') : null,
      theirs: theirs.join('\n')
    })
  }
  return blocks
}

/** 按顺序合并全部冲突块。 */
export function resolveAllConflictBlocks(
  text: string,
  choice: ConflictChoice
): { text: string; count: number } {
  const blocks = parseConflictBlocks(text)
  let next = text
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    next = resolveConflictBlock(next, index, choice)
  }
  return { text: next, count: blocks.length }
}

/** 用指定策略替换单个冲突块，其余内容保持不变。 */
export function resolveConflictBlock(
  text: string,
  index: number,
  choice: ConflictChoice
): string {
  const lines = text.split('\n')
  const block = parseConflictBlocks(text).find((item) => item.index === index)
  if (!block) return text
  const replacement: string[] = []
  if (choice === 'ours' || choice === 'both') {
    if (block.ours.length > 0) replacement.push(...block.ours.split('\n'))
  }
  if (choice === 'theirs' || choice === 'both') {
    if (block.theirs.length > 0) replacement.push(...block.theirs.split('\n'))
  }
  return [
    ...lines.slice(0, block.startLine),
    ...replacement,
    ...lines.slice(block.endLine + 1)
  ].join('\n')
}
