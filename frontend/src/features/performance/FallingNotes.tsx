const notes = [
  { left: '13%', top: '9%', height: 28, opacity: 0.94 },
  { left: '22%', top: '24%', height: 44, opacity: 0.72 },
  { left: '31%', top: '15%', height: 36, opacity: 0.86 },
  { left: '43%', top: '36%', height: 58, opacity: 0.68 },
  { left: '54%', top: '20%', height: 34, opacity: 0.9 },
  { left: '62%', top: '42%', height: 50, opacity: 0.74 },
  { left: '72%', top: '28%', height: 42, opacity: 0.82 },
  { left: '84%', top: '14%', height: 64, opacity: 0.76 },
]

const keys = Array.from({ length: 28 }, (_, index) => index)

export function FallingNotes() {
  return (
    <section className="relative min-h-[460px] overflow-hidden rounded-lg bg-card shadow-heavy">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:7.14%_100%,100%_4rem]" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-spotify-green/80 shadow-[0_0_24px_rgba(30,215,96,0.65)]" />
      <div className="absolute left-4 top-4 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-[1.4px] text-muted-foreground">
        Live Score
      </div>

      {notes.map((note, index) => (
        <div
          key={`${note.left}-${index}`}
          className="absolute w-8 rounded-sm bg-spotify-green shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={{
            left: note.left,
            top: note.top,
            height: `${note.height}px`,
            opacity: note.opacity,
          }}
        />
      ))}

      <div className="absolute inset-x-4 bottom-4 grid grid-cols-[repeat(28,minmax(0,1fr))] gap-0.5">
        {keys.map((key) => (
          <div
            key={key}
            className={[
              'h-20 rounded-b-sm',
              key % 7 === 1 || key % 7 === 4
                ? 'bg-near-black'
                : 'bg-[#eeeeee]',
            ].join(' ')}
          />
        ))}
      </div>
    </section>
  )
}
