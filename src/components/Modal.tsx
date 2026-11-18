import { useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useModalFocus } from './modalFocus'

interface ModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export default function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId()
  const modalRef = useRef<HTMLDivElement>(null)
  useModalFocus(modalRef, titleId, onClose)

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} title="关闭" aria-label="关闭">
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
