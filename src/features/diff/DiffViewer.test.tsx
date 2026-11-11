// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DiffViewer from './DiffViewer'
import { useApp } from '../../store/app'
import type { DiffDto } from '../../lib/types'

const diff: DiffDto = {
  path: 'src/example.ts',
  oldPath: null,
  status: 'modified',
  binary: false,
  additions: 1,
  deletions: 0,
  hunks: [
    {
      header: '@@ -1 +1,2 @@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 2,
      lines: [
        { kind: 'context', oldLineNo: 1, newLineNo: 1, content: 'const value = 1' },
        { kind: 'add', oldLineNo: null, newLineNo: 2, content: 'const added = true' }
      ]
    }
  ]
}

describe('DiffViewer', () => {
  beforeEach(() => {
    useApp.setState({
      repo: {
        path: '/tmp/repo',
        name: 'repo',
        branch: 'main',
        headOid: null,
        headShort: null,
        detached: false,
        bare: false,
        remoteUrl: null,
        state: 'clean'
      }
    })
  })

  it('selects changed lines and exposes staging actions', () => {
    const onApply = vi.fn()
    render(
      <DiffViewer
        diff={diff}
        layout="unified"
        onLayoutChange={vi.fn()}
        actionMode="stage"
        onApply={onApply}
        contextLines={3}
        onContextLinesChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('const added = true'))
    fireEvent.click(screen.getByText('暂存选中行'))
    expect(onApply).toHaveBeenCalledWith([{ hunk: 0, lines: [1] }])
  })
})
