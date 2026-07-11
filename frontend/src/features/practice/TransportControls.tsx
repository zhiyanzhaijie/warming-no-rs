import type { PracticeMode } from '../../shared/types/domain'
import { usePracticeStore } from './practiceStore'

const modes: Array<{ value: PracticeMode; label: string }> = [
  { value: 'listen', label: '聆听' },
  { value: 'right-hand', label: '右手' },
  { value: 'left-hand', label: '左手' },
  { value: 'both-hands', label: '双手' },
]

type TransportControlsProps = {
  compact?: boolean
}

export function TransportControls({ compact = false }: TransportControlsProps) {
  const bpm = usePracticeStore((state) => state.bpm)
  const isPlaying = usePracticeStore((state) => state.isPlaying)
  const loopEnabled = usePracticeStore((state) => state.loopEnabled)
  const loopRange = usePracticeStore((state) => state.loopRange)
  const mode = usePracticeStore((state) => state.mode)
  const setBpm = usePracticeStore((state) => state.setBpm)
  const setMode = usePracticeStore((state) => state.setMode)
  const togglePlayback = usePracticeStore((state) => state.togglePlayback)
  const toggleLoop = usePracticeStore((state) => state.toggleLoop)

  return (
    <section className={compact ? '' : 'rounded-lg bg-card p-4 shadow-medium'}>
      <div className={compact ? 'flex items-center gap-2' : 'flex flex-wrap items-center gap-2'}>
        <button
          type="button"
          onClick={togglePlayback}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-spotify-green text-sm font-bold text-primary-foreground shadow-heavy transition hover:bg-spotify-green-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spotify-green"
          aria-label={isPlaying ? '暂停' : '播放'}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? 'II' : '>'}
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
              className="w-28 accent-spotify-green"
              type="range"
              min="40"
              max="140"
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
            />
            <span className="w-14 text-xs font-bold text-foreground">{bpm} BPM</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleLoop}
          className={[
            'shrink-0 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[1.4px] transition max-[1180px]:hidden',
            loopEnabled
              ? 'bg-secondary text-spotify-green'
              : 'bg-secondary text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Loop {loopRange[0]}-{loopRange[1]}
        </button>

        <div className="flex rounded-full bg-secondary p-1 max-[1060px]:hidden">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={[
                'rounded-full px-3 py-1.5 text-xs transition',
                mode === item.value
                  ? 'bg-foreground font-bold text-background'
                  : 'font-normal text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
