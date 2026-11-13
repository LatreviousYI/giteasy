import { useEffect } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { useUpdates } from '../../store/updates'

function installKindLabel(kind: string | undefined) {
  switch (kind) {
    case 'appimage':
      return 'AppImage'
    case 'macos':
      return 'macOS App'
    case 'deb':
      return '系统 .deb 安装'
    default:
      return '便携版'
  }
}

export default function UpdateSection() {
  const status = useUpdates((state) => state.status)
  const context = useUpdates((state) => state.context)
  const availableVersion = useUpdates((state) => state.availableVersion)
  const notes = useUpdates((state) => state.notes)
  const downloadedBytes = useUpdates((state) => state.downloadedBytes)
  const totalBytes = useUpdates((state) => state.totalBytes)
  const error = useUpdates((state) => state.error)
  const check = useUpdates((state) => state.check)
  const install = useUpdates((state) => state.install)
  const openDownloadPage = useUpdates((state) => state.openDownloadPage)

  useEffect(() => {
    if (status === 'idle') void check()
  }, [check, status])

  const percent =
    totalBytes && totalBytes > 0
      ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
      : null
  const busy =
    status === 'checking' ||
    status === 'downloading' ||
    status === 'installing'

  return (
    <div className="update-section">
      <div className="update-section-head">
        <div>
          <div className="label">关于与更新</div>
          <div className="update-version">
            当前版本 {context?.currentVersion ?? '…'} ·{' '}
            {installKindLabel(context?.installKind)}
          </div>
        </div>
        <span className="spacer" />
        <button
          className="btn btn-sm"
          onClick={() => void check(true)}
          disabled={busy}
        >
          <RefreshCw size={12} className={status === 'checking' ? 'animate-spin' : ''} />
          检查更新
        </button>
      </div>

      {status === 'up-to-date' && (
        <div className="update-status success">
          <CheckCircle2 size={14} />
          当前已是最新版本
        </div>
      )}

      {status === 'available' && (
        <div className="update-available-panel">
          <div className="update-status">
            <Download size={14} />
            新版本 <b>{availableVersion}</b> 可用
          </div>
          {notes && <div className="update-notes">{notes}</div>}
          <div className="update-actions">
            {context?.canInstallInPlace ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => void install()}
              >
                <Download size={12} />
                下载并安装
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => void openDownloadPage()}
              >
                <Download size={12} />
                前往下载
              </button>
            )}
          </div>
        </div>
      )}

      {(status === 'downloading' || status === 'installing') && (
        <div className="update-progress">
          <div className="update-status">
            <Loader2 size={14} className="animate-spin" />
            {status === 'installing'
              ? '正在安装，完成后应用将自动重启'
              : percent === null
                ? '正在下载更新…'
                : `正在下载更新 ${percent}%`}
          </div>
          <span className="progress-track">
            <span
              className="progress-fill block"
              style={{ width: percent === null ? '35%' : `${percent}%` }}
            />
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="update-status danger">
          <AlertCircle size={14} />
          <span>{error ?? '检查更新失败'}</span>
        </div>
      )}
    </div>
  )
}
