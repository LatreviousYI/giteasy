import { describe, expect, it } from 'vitest'
import { clampContextMenuPosition } from './contextMenu'

const viewport = { width: 1200, height: 800 }

describe('clampContextMenuPosition', () => {
  it('keeps a menu near the pointer when it fits', () => {
    expect(clampContextMenuPosition(200, 160, 300, 420, viewport)).toEqual({
      x: 200,
      y: 160
    })
  })

  it('moves the menu above the pointer near the bottom edge', () => {
    expect(clampContextMenuPosition(200, 760, 300, 420, viewport)).toEqual({
      x: 200,
      y: 340
    })
  })

  it('keeps the menu inside the right and left margins', () => {
    expect(clampContextMenuPosition(1190, 160, 300, 420, viewport).x).toBe(892)
    expect(clampContextMenuPosition(-20, 160, 300, 420, viewport).x).toBe(8)
  })

  it('caps menus taller than the viewport', () => {
    expect(clampContextMenuPosition(100, 700, 300, 900, viewport)).toEqual({
      x: 100,
      y: 8
    })
  })
})
