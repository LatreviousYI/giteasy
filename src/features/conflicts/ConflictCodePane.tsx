import { useLayoutEffect, useRef } from 'react'
import type { ConflictCodeRange } from './conflictCodeRange'

interface ConflictCodePaneProps {
  label: string
  text: string
  range: ConflictCodeRange | null
}

export default function ConflictCodePane({ label, text, range }: ConflictCodePaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lines = text.split('\n')

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || !range) return
    const highlighted = container.querySelector<HTMLElement>('[data-conflict-highlight="true"]')
    if (!highlighted) return
    const containerRect = container.getBoundingClientRect()
    const highlightedRect = highlighted.getBoundingClientRect()
    const targetTop =
      container.scrollTop +
      highlightedRect.top -
      containerRect.top -
      (container.clientHeight - highlightedRect.height) / 2
    container.scrollTop = Math.max(0, targetTop)
  }, [range])

  return (
    <section className="conflict-code-pane" aria-label={label}>
      <div className="conflict-code-pane-head">{label}</div>
      <div ref={scrollRef} className="conflict-code-lines">
        {text.length === 0 ? (
          <div className="conflict-code-empty">（该版本为空）</div>
        ) : (
          lines.map((line, index) => {
            const highlighted = range !== null && index >= range.startLine && index <= range.endLine
            return (
              <div
                key={`${index}-${line}`}
                className={`conflict-code-line ${highlighted ? 'active' : ''}`}
                data-conflict-highlight={highlighted ? 'true' : undefined}
              >
                <span className="conflict-line-number">{index + 1}</span>
                <span className="conflict-line-text">{line || ' '}</span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
