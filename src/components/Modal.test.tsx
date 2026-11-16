// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import Modal from './Modal'
import { PromptDialog } from './Dialogs'

afterEach(cleanup)

function ModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>打开对话框</button>
      {open && (
        <Modal title="测试标题" onClose={() => setOpen(false)} footer={<button>完成</button>}>
          <input aria-label="名称" autoFocus />
        </Modal>
      )}
    </>
  )
}

describe('Modal accessibility', () => {
  it('exposes dialog semantics and an accessible title', () => {
    render(
      <Modal title="测试标题" onClose={vi.fn()}>
        <p>内容</p>
      </Modal>
    )

    const dialog = screen.getByRole('dialog', { name: '测试标题' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy()
  })

  it('traps focus, closes with Escape and restores the trigger focus', async () => {
    render(<ModalHarness />)
    const trigger = screen.getByRole('button', { name: '打开对话框' })
    trigger.focus()
    fireEvent.click(trigger)

    const input = screen.getByRole('textbox', { name: '名称' })
    expect(document.activeElement).toBe(input)
    const close = screen.getByRole('button', { name: '关闭' })
    const done = screen.getByRole('button', { name: '完成' })

    done.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(done)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('associates PromptDialog labels with their input', () => {
    render(
      <PromptDialog open title="创建分支" label="分支名称" onSubmit={vi.fn()} onCancel={vi.fn()} />
    )

    expect(screen.getByLabelText('分支名称')).toBeTruthy()
  })
})
