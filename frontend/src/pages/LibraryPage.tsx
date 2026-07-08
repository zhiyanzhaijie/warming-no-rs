import { useQuery } from '@tanstack/react-query'
import { scoreApi } from '../api/score'
import { PieceCard } from '../features/library/PieceCard'

export function LibraryPage() {
  const { data: pieces = [] } = useQuery({
    queryKey: ['pieces'],
    queryFn: scoreApi.listPieces,
  })

  return (
    <div className="p-6 max-[720px]:p-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.8px] text-muted-foreground">
            MIDI Library
          </p>
          <h1 className="mt-2 font-title text-2xl font-bold text-foreground">
            本地曲库
          </h1>
        </div>
        <button className="rounded-full bg-spotify-green px-5 py-2.5 text-sm font-bold uppercase tracking-[1.4px] text-primary-foreground shadow-heavy transition hover:bg-spotify-green-hover">
          导入 MIDI
        </button>
      </header>

      <section className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
        {pieces.map((piece) => (
          <PieceCard key={piece.id} piece={piece} />
        ))}
      </section>
    </div>
  )
}
