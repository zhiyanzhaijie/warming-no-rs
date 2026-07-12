import type { PracticeMode } from '../../shared/types/domain'
import { usePracticeStore } from './practiceStore'
import { Pause, Play } from 'lucide-react'

const modes: Array<{ value: PracticeMode; label: string }> = [
  { value: 'listen', label: '聆听' },
  { value: 'free', label: '自由' },
  { value: 'right-hand', label: '右手' },
  { value: 'left-hand', label: '左手' },
  { value: 'both-hands', label: '双手' },
]

type TransportControlsProps = {
  compact?: boolean
  availableModes?: ReadonlySet<PracticeMode>
}

export function TransportControls({
  compact = false,
  availableModes = defaultModes,
}: TransportControlsProps) {
  const bpm = usePracticeStore((state) => state.bpm)
  const isPlaying = usePracticeStore((state) => state.isPlaying)
  const loopEnabled = usePracticeStore((state) => state.loopEnabled)
  const loopRange = usePracticeStore((state) => state.loopRange)
  const mode = usePracticeStore((state) => state.mode)
  const setBpm = usePracticeStore((state) => state.setBpm)
  const setMode = usePracticeStore((state) => state.setMode)
  const togglePlayback = usePracticeStore((state) => state.togglePlayback)
  const toggleLoop = usePracticeStore((state) => state.toggleLoop)
  const timedMode = mode !== 'free'

  return (
    <section className={compact ? '' : 'rounded-lg bg-card p-4 shadow-medium'}>
      <div className={compact ? 'flex items-center gap-2' : 'flex flex-wrap items-center gap-2'}>
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!timedMode}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-spotify-green text-primary-foreground shadow-heavy transition hover:bg-spotify-green-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spotify-green disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
          aria-label={timedMode ? (isPlaying ? '暂停' : '播放') : '自由模式不自动播放'}
          title={timedMode ? (isPlaying ? '暂停' : '播放') : '自由模式不自动播放'}
        >
          {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>

        <div className={compact ? 'grid gap-1 max-[760px]:hidden' : 'grid gap-1'}>
          <label
            htmlFor="practice-tempo"
            className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground"
          >
            Tempo
          </label>
          <div className="flex items-center gap-3">
            <input
              id="practice-tempo"
              type="range"
              min="40"
              max="140"
              value={bpm}
              disabled={!timedMode}
              onChange={(event) => setBpm(Number(event.target.value))}
              className="w-28 accent-spotify-green disabled:cursor-not-allowed disabled:opacity-40"
            />
            <span className="w-14 text-xs font-bold text-foreground">{bpm} BPM</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleLoop}
          disabled={!timedMode}
          className={[
            'shrink-0 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[1.4px] transition disabled:cursor-not-allowed disabled:opacity-40 max-[1180px]:hidden',
            loopEnabled
              ? 'bg-secondary text-spotify-green'
              : 'bg-secondary text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Loop {loopRange[0]}-{loopRange[1]}
        </button>

        <div className="flex rounded-full bg-secondary p-1">
          {modes.map((item) => {
            const disabled = !availableModes.has(item.value)
            return (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              onClick={() => setMode(item.value)}
              title={disabled ? `当前曲目没有可识别的${item.label}声部` : item.label}
              className={[
                'rounded-full px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-35',
                mode === item.value
                  ? 'bg-foreground font-bold text-background'
                  : 'font-normal text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {item.label}
            </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const defaultModes: ReadonlySet<PracticeMode> = new Set(['listen', 'free'])
