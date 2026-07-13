import { memo, useMemo } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { PieceScore } from '../../shared/types/domain'
import { usePracticeStore } from './practiceStore'
import type { MeasureTiming } from './measureTiming'
import { buildMeasureTimings, formatPlaybackTime } from './measureTiming'

type MeasureProgressProps = {
  score?: PieceScore
  expanded?: boolean
  onToggleExpanded?: () => void
}

export function MeasureProgress({ score, expanded, onToggleExpanded }: MeasureProgressProps) {
  const currentBeat = usePracticeStore((state) => state.currentBeat)
  const bpm = usePracticeStore((state) => state.bpm)
  const requestSeek = usePracticeStore((state) => state.requestSeek)
  const loopRange = usePracticeStore((state) => state.loopRange)
  const loopSelecting = usePracticeStore((state) => state.loopSelecting)
  const loopSelectionAnchor = usePracticeStore((state) => state.loopSelectionAnchor)
  const selectLoopMeasure = usePracticeStore((state) => state.selectLoopMeasure)
  const measures = useMemo(
    () => buildMeasureTimings(score?.totalBeats ?? 0, score?.timeSignature ?? '4/4'),
    [score?.timeSignature, score?.totalBeats],
  )
  const totalBeats = score?.totalBeats ?? 0
  const progressPercent = totalBeats > 0 ? Math.min(100, (currentBeat / totalBeats) * 100) : 0
  const secondsPerBeat = 60 / Math.max(1, bpm)

  return (
    <div className="relative h-3 shrink-0 bg-muted">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 bg-primary/75"
        style={{ width: `${progressPercent}%` }}
      />

      {loopRange && totalBeats > 0 ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-20 border-x border-foreground/50 bg-foreground/20"
          style={{
            left: `${(loopRange.startBeat / totalBeats) * 100}%`,
            width: `${((loopRange.endBeat - loopRange.startBeat) / totalBeats) * 100}%`,
          }}
        />
      ) : null}

      <MeasureSegments
        measures={measures}
        secondsPerBeat={secondsPerBeat}
        pieceId={score?.pieceId ?? ''}
        requestSeek={requestSeek}
        loopSelecting={loopSelecting}
        loopSelectionAnchorNumber={loopSelectionAnchor?.number}
        selectLoopMeasure={selectLoopMeasure}
      />

      <span className="pointer-events-none absolute inset-y-0 left-3 z-20 flex items-center text-[8px] font-bold tracking-wider tabular-nums text-foreground/60">
        {formatPlaybackTime(currentBeat * secondsPerBeat)}
      </span>
      <span className="pointer-events-none absolute inset-y-0 right-3 z-20 flex items-center text-[8px] font-bold tracking-wider tabular-nums text-foreground/60">
        {formatPlaybackTime(totalBeats * secondsPerBeat)}
      </span>

      {onToggleExpanded ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="group absolute left-1/2 top-full z-40 h-4 w-24 -translate-x-1/2 cursor-pointer bg-transparent outline-none"
          aria-label={expanded ? '收起练习控制' : '展开练习控制'}
          title={expanded ? '收起练习控制' : '展开练习控制'}
        >
          <span className="absolute left-1/2 top-1 h-px w-9 -translate-x-1/2 bg-foreground/35 transition-all duration-300 ease-out group-hover:w-20 group-hover:bg-foreground/90 group-hover:shadow-[0_0_5px_color-mix(in_srgb,var(--foreground)_70%,transparent),0_0_14px_color-mix(in_srgb,var(--foreground)_35%,transparent)] group-focus-visible:w-20 group-focus-visible:bg-foreground/90" />
        </button>
      ) : null}
    </div>
  )
}

const MeasureSegments = memo(function MeasureSegments({
  measures,
  secondsPerBeat,
  pieceId,
  requestSeek,
  loopSelecting,
  loopSelectionAnchorNumber,
  selectLoopMeasure,
}: {
  measures: MeasureTiming[]
  secondsPerBeat: number
  pieceId: string
  requestSeek: (pieceId: string, beat: number) => void
  loopSelecting: boolean
  loopSelectionAnchorNumber?: number
  selectLoopMeasure: (measure: { number: number; startBeat: number; endBeat: number }) => void
}) {
  return (
    <TooltipProvider delayDuration={180}>
      <div className="absolute inset-0 z-20 flex">
        {measures.map((measure) => {
          const startSeconds = measure.startBeat * secondsPerBeat
          const durationSeconds = measure.durationBeats * secondsPerBeat
          return (
            <Tooltip key={measure.number}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (loopSelecting) {
                      selectLoopMeasure({
                        number: measure.number,
                        startBeat: measure.startBeat,
                        endBeat: measure.startBeat + measure.durationBeats,
                      })
                    } else {
                      requestSeek(pieceId, measure.startBeat)
                    }
                  }}
                  aria-label={`跳转到第 ${measure.number} 小节`}
                  className={`relative h-full cursor-pointer border-r border-foreground/20 outline-none last:border-r-0 hover:bg-foreground/10 focus-visible:bg-foreground/20 ${loopSelectionAnchorNumber === measure.number ? 'bg-foreground/30' : ''}`}
                  style={{ flexGrow: measure.durationBeats, flexBasis: 0 }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="rounded-none border border-border bg-foreground px-2 py-1 text-[10px] font-bold text-background shadow-2xl">
                {measure.number} · {formatPlaybackTime(startSeconds)} · {durationSeconds.toFixed(1)}s
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
})
