import { memo, useMemo } from 'react'
import type { PieceScore } from '../../shared/types/domain'
import { usePracticeStore } from './practiceStore'
import type { MeasureTiming } from './measureTiming'
import { buildMeasureTimings, formatPlaybackTime } from './measureTiming'

type MeasureProgressProps = {
  score?: PieceScore
}

export function MeasureProgress({ score }: MeasureProgressProps) {
  const currentBeat = usePracticeStore((state) => state.currentBeat)
  const bpm = usePracticeStore((state) => state.bpm)
  const measures = useMemo(
    () => buildMeasureTimings(score?.totalBeats ?? 0, score?.timeSignature ?? '4/4'),
    [score?.timeSignature, score?.totalBeats],
  )
  const totalBeats = score?.totalBeats ?? 0
  const progressPercent = totalBeats > 0 ? Math.min(100, (currentBeat / totalBeats) * 100) : 0
  const secondsPerBeat = 60 / Math.max(1, bpm)

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-md bg-card px-3 py-2 shadow-medium">
      <span className="w-10 text-right text-[10px] font-bold tabular-nums text-muted-foreground">
        {formatPlaybackTime(currentBeat * secondsPerBeat)}
      </span>

      <div className="relative flex h-2 min-w-0 flex-1 overflow-visible rounded-full bg-secondary">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 rounded-full bg-spotify-green"
          style={{ width: `${progressPercent}%` }}
        />

        <MeasureSegments measures={measures} secondsPerBeat={secondsPerBeat} />
      </div>

      <span className="w-10 text-[10px] font-bold tabular-nums text-muted-foreground">
        {formatPlaybackTime(totalBeats * secondsPerBeat)}
      </span>
    </div>
  )
}

const MeasureSegments = memo(function MeasureSegments({
  measures,
  secondsPerBeat,
}: {
  measures: MeasureTiming[]
  secondsPerBeat: number
}) {
  return measures.map((measure) => {
    const startSeconds = measure.startBeat * secondsPerBeat
    const durationSeconds = measure.durationBeats * secondsPerBeat
    return (
      <div
        key={measure.number}
        className="group relative z-20 h-full border-r border-background/80 last:border-r-0"
        style={{ flexGrow: measure.durationBeats, flexBasis: 0 }}
      >
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#282828] px-2 py-1 text-[10px] font-bold text-foreground shadow-heavy group-hover:block">
          {measure.number} · {formatPlaybackTime(startSeconds)} · {durationSeconds.toFixed(1)}s
        </div>
      </div>
    )
  })
})
