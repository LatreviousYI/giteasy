import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Columns2, Images, SlidersHorizontal } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { Spinner } from '../../components/Empty'

export default function ImageDiffViewer({
  repoPath,
  file,
  source,
  left,
  right,
  staged
}: {
  repoPath: string
  file: string
  source: 'workdir' | 'commit' | 'range'
  left?: string | null
  right?: string | null
  staged?: boolean
}) {
  const [mode, setMode] = useState<'side' | 'slider' | 'onion'>('side')
  const [position, setPosition] = useState(50)
  const [opacity, setOpacity] = useState(50)
  const query = useQuery({
    queryKey: ['imageDiff', repoPath, file, source, left, right, staged],
    queryFn: () => ipc.imageDiff(repoPath, file, source, left, right, staged)
  })

  if (query.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!query.data) {
    return <div className="binary-note">无法读取图片版本</div>
  }

  const before = query.data.before
  const after = query.data.after

  return (
    <div className="image-diff-viewer">
      <div className="image-diff-toolbar">
        <div className="seg">
          <button className={mode === 'side' ? 'active' : ''} onClick={() => setMode('side')}>
            <Columns2 size={12} /> 并排
          </button>
          <button className={mode === 'slider' ? 'active' : ''} onClick={() => setMode('slider')}>
            <SlidersHorizontal size={12} /> 滑动
          </button>
          <button className={mode === 'onion' ? 'active' : ''} onClick={() => setMode('onion')}>
            <Images size={12} /> 洋葱皮
          </button>
        </div>
        <span className="spacer" />
        <span className="row-sub">
          {query.data.beforeSize} B → {query.data.afterSize} B
        </span>
      </div>

      {mode === 'side' ? (
        <div className="image-diff-side">
          <div className="image-diff-panel">
            <div className="image-diff-label">修改前</div>
            {before ? <img src={before} alt="" /> : <div className="image-diff-empty">新增图片</div>}
          </div>
          <div className="image-diff-panel">
            <div className="image-diff-label">修改后</div>
            {after ? <img src={after} alt="" /> : <div className="image-diff-empty">图片已删除</div>}
          </div>
        </div>
      ) : mode === 'slider' ? (
        <div>
          <div className="image-diff-overlay">
            {after && <img src={after} alt="" />}
            {before && (
              <div
                className="image-diff-before-layer"
                style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
              >
                <img src={before} alt="" />
              </div>
            )}
          </div>
          <input
            className="image-diff-range"
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
          />
        </div>
      ) : (
        <div>
          <div className="image-diff-overlay">
            {before && <img src={before} alt="" />}
            {after && (
              <div className="image-diff-onion-layer" style={{ opacity: opacity / 100 }}>
                <img src={after} alt="" />
              </div>
            )}
          </div>
          <input
            className="image-diff-range"
            type="range"
            min="0"
            max="100"
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
        </div>
      )}
    </div>
  )
}
