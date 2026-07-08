import type { PracticeMode } from '../../shared/types/domain'
import { usePracticeStore } from './practiceStore'

const modes: Array<{ value: PracticeMode; label: string }> = [
  { value: 'listen', label: '聆听' },
  { value: 'right-hand', label: '右手' },
  { value: 'left-hand', label: '左手' },
  { value: 'both-hands', label: '双手' },
]

export function TransportControls() {
  const {
    bpm,
    isPlaying,
    loopEnabled,
    loopRange,
    mode,
    setBpm,
    setMode,
    togglePlayback,
    toggleLoop,
  } = usePracticeStore()

  return (
    <section className="rounded-lg bg-card p-4 shadow-medium">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="grid size-12 place-items-center rounded-full bg-spotify-green text-base font-bold text-primary-foreground shadow-heavy transition hover:bg-spotify-green-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spotify-green"
          aria-label={isPlaying ? '暂停' : '播放'}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? 'II' : '>'}
        </button>

        <div className="grid gap-1">
          <label className="text-xs font-bold uppercase tracking-[1.4px] text-muted-foreground">
            Tempo
          </label>
          <div className="flex items-center gap-3">
            <input
              className="w-36 accent-spotify-green"
              type="range"
              min="40"
              max="140"
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
            />
            <span className="w-16 text-sm font-bold text-foreground">{bpm} BPM</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleLoop}
          className={[
            'rounded-full px-4 py-2 text-sm font-bold uppercase tracking-[1.4px] transition',
            loopEnabled
              ? 'bg-secondary text-spotify-green'
              : 'bg-secondary text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Loop {loopRange[0]}-{loopRange[1]}
        </button>

        <div className="ml-auto flex rounded-full bg-secondary p-1 max-[720px]:ml-0">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={[
                'rounded-full px-3 py-1.5 text-sm transition',
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
