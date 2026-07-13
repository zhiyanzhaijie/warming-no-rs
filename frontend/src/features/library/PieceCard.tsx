import { Link } from 'react-router-dom'
import type { Piece } from '../../shared/types/domain'
import { Play, Music, Clock, Activity, Trash2, X, Check, FileText } from 'lucide-react'

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
    <article className="group relative flex flex-col overflow-hidden border-b border-border/40 bg-transparent py-6 transition-all duration-500 hover:bg-foreground/[0.02]">
      <div className="flex items-start justify-between gap-4 px-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate font-title text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              {piece.title}
            </h2>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              {piece.level}
            </span>
          </div>
          <p
            className="mt-1 truncate text-[11px] font-medium text-muted-foreground"
            title={piece.sourcePath ?? piece.composer}
          >
            {piece.sourcePath ?? piece.composer}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-1.5" title="音符数">
          <Music className="size-3 text-muted-foreground/70" />
          <span>{piece.noteCount ?? 0}</span>
        </div>
        <div className="flex items-center gap-1.5" title="速度">
          <Activity className="size-3 text-muted-foreground/70" />
          <span>{piece.bpm} BPM</span>
        </div>
        <div className="flex items-center gap-1.5" title="时长">
          <Clock className="size-3 text-muted-foreground/70" />
          <span>{piece.durationSeconds}s</span>
        </div>
      </div>

      <div className="mt-4 flex-1 px-2">
        <div className="flex justify-between text-[9px] font-bold tracking-widest text-muted-foreground">
          <span>PROGRESS</span>
          <span className="text-foreground/80">{Math.round(piece.progress * 100)}%</span>
        </div>
        <div className="mt-1.5 h-[2px] overflow-hidden bg-muted/10">
          <div
            className="h-full bg-foreground transition-all duration-500 ease-out group-hover:bg-primary"
            style={{ width: `${piece.progress * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 px-2">
        {confirmingRemove ? (
          <div className="flex w-full items-center justify-between border-t border-border/40 bg-transparent pt-3">
            <span className="whitespace-nowrap text-[9px] font-bold tracking-widest text-destructive">确认抹去此档案?</span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={onCancelRemove}
                className="grid size-7 place-items-center bg-muted/10 text-muted-foreground transition hover:bg-muted/20 hover:text-foreground disabled:opacity-50"
                title="取消"
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => onRemove(piece)}
                className="grid size-7 place-items-center bg-destructive text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
                title="确认移除"
              >
                <Check className="size-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <Link
              className="flex h-8 min-w-0 flex-1 items-center justify-center gap-2 border border-border/40 bg-transparent px-3 text-[10px] font-bold uppercase tracking-widest text-foreground transition-all hover:border-foreground hover:bg-foreground hover:text-background"
              to={`/practice?pieceId=${encodeURIComponent(piece.id)}`}
            >
              <Play className="size-3 shrink-0 fill-current" />
              <span className="truncate">开始练习</span>
            </Link>
            <Link
              className="grid size-8 shrink-0 place-items-center border border-border/20 bg-transparent text-muted-foreground transition-all hover:border-foreground/50 hover:text-foreground"
              to={`/pieces/${piece.id}`}
              title="查看谱面"
            >
              <FileText className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => onRemove(piece)}
              className="grid size-8 shrink-0 place-items-center border border-transparent bg-transparent text-muted-foreground/40 transition-all hover:text-destructive"
              aria-label={`从曲库移除 ${piece.title}`}
              title="从曲库移除"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </article>
  )
}
