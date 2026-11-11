import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useApp } from '../store/app'

const icons = {
  success: <CheckCircle2 size={14} className="add-text" />,
  error: <XCircle size={14} className="danger-text" />,
  warn: <AlertTriangle size={14} className="text-subtle" />,
  info: <Info size={14} className="text-subtle" />
}

export default function ToastHost() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (toasts.length === 0) return null

  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <div className="toast-title">
            {icons[toast.kind]}
            <span style={{ flex: 1 }}>{toast.title}</span>
            <button className="icon-btn" onClick={() => dismiss(toast.id)}>
              <X size={13} />
            </button>
          </div>
          {toast.hint && <div className="toast-sub">{toast.hint}</div>}
          {toast.message && toast.message !== toast.title && (
            <div className="toast-sub">{toast.message}</div>
          )}
          {toast.detail && (
            <div>
              <button
                className="btn btn-sm btn-ghost"
                style={{ paddingLeft: 0, height: 20, marginTop: 4 }}
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [toast.id]: !prev[toast.id] }))
                }
              >
                {expanded[toast.id] ? '收起详情' : '查看详情'}
              </button>
              {expanded[toast.id] && <div className="toast-detail">{toast.detail}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
