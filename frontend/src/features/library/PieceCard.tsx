import { Link } from 'react-router-dom'
import type { Piece } from '../../shared/types/domain'
import { Trash2 } from 'lucide-react'

type PieceCardProps = {
  piece: Piece
  onRemove: (piece: Piece) => void
  onCancelRemove: () => void
  confirmingRemove?: boolean
  removing?: boolean
}

export function PieceCard({
  piece,
  onRemove,
  onCancelRemove,
  confirmingRemove = false,
  removing = false,
}: PieceCardProps) {
  return (
    <article className="rounded-lg bg-card p-4 transition hover:bg-dark-card hover:shadow-medium">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-title text-lg font-bold leading-tight text-foreground">
            {piece.title}
          </h2>
          <p
            className="mt-1 truncate text-sm font-normal text-muted-foreground"
            title={piece.sourcePath ?? piece.composer}
          >
            {piece.sourcePath ?? piece.composer}
          </p>
        </div>
        <span className="rounded-sm bg-secondary px-2 py-1 text-[10.5px] font-semibold capitalize text-near-white">
          {piece.level}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs font-bold text-muted-foreground">音符</dt>
          <dd className="mt-1 font-bold text-foreground">{piece.noteCount ?? 0}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">速度</dt>
          <dd className="mt-1 font-bold text-foreground">{piece.bpm} BPM</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">时长</dt>
          <dd className="mt-1 font-bold text-foreground">{piece.durationSeconds}s</dd>
        </div>
      </dl>

      <div className="mt-5">
        <div className="flex justify-between text-xs font-bold text-muted-foreground">
          <span>掌握度</span>
          <span>{Math.round(piece.progress * 100)}%</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-spotify-green"
            style={{ width: `${piece.progress * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          className="rounded-full bg-spotify-green px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-spotify-green-hover"
          to={`/pieces/${piece.id}`}
        >
          查看
        </Link>
        <Link
          className="rounded-full bg-secondary px-4 py-2 text-sm font-bold text-foreground transition hover:bg-dark-card"
          to={`/practice?pieceId=${encodeURIComponent(piece.id)}`}
        >
          练习
        </Link>
        {confirmingRemove ? (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={removing}
              onClick={onCancelRemove}
              className="rounded-full bg-secondary px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={() => onRemove(piece)}
              className="rounded-full bg-destructive px-3 py-2 text-xs font-bold text-background disabled:cursor-wait disabled:opacity-60"
            >
              {removing ? '正在移除' : '确认移除'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onRemove(piece)}
            className="ml-auto grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground transition hover:bg-destructive hover:text-background"
            aria-label={`从曲库移除 ${piece.title}`}
            title="从曲库移除"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </article>
  )
}
