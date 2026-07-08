import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { scoreApi } from '../api/score'
import { PieceCard } from '../features/library/PieceCard'

export function LibraryPage() {
  const queryClient = useQueryClient()
  const [path, setPath] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const { data: pieces = [], isError, error } = useQuery({
    queryKey: ['pieces'],
    queryFn: scoreApi.listPieces,
  })
  const { data: watchPaths } = useQuery({
    queryKey: ['watch-paths'],
    queryFn: scoreApi.listWatchPaths,
  })
  const addWatchPath = useMutation({
    mutationFn: scoreApi.addWatchPath,
    onSuccess: (report) => {
      setPath('')
      setMessage(
        `扫描 ${report.discoveredFiles} 个 MIDI，新增 ${report.registeredFiles} 首曲目`,
      )
      void queryClient.invalidateQueries({ queryKey: ['pieces'] })
      void queryClient.invalidateQueries({ queryKey: ['watch-paths'] })
    },
    onError: (mutationError) => {
      setMessage(mutationError instanceof Error ? mutationError.message : '路径扫描失败')
    },
  })
  const refresh = useMutation({
    mutationFn: scoreApi.refreshLocalLibrary,
    onSuccess: (report) => {
      setMessage(
        `刷新完成：发现 ${report.discoveredFiles} 个 MIDI，新增 ${report.registeredFiles} 首`,
      )
      void queryClient.invalidateQueries({ queryKey: ['pieces'] })
      void queryClient.invalidateQueries({ queryKey: ['watch-paths'] })
    },
    onError: (mutationError) => {
      setMessage(mutationError instanceof Error ? mutationError.message : '刷新失败')
    },
  })

  const submitPath = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = path.trim()
    if (!value) {
      setMessage('请输入本地 MIDI 文件或目录路径')
      return
    }
    addWatchPath.mutate(value)
  }

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
        <button
          type="button"
          onClick={() => refresh.mutate()}
          className="rounded-full bg-spotify-green px-5 py-2.5 text-sm font-bold uppercase tracking-[1.4px] text-primary-foreground shadow-heavy transition hover:bg-spotify-green-hover"
        >
          刷新曲库
        </button>
      </header>

      <section className="mt-5 rounded-lg bg-card p-4 shadow-medium">
        <form className="flex gap-2 max-[720px]:flex-col" onSubmit={submitPath}>
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/Users/name/Music/MIDI 或 /path/to/file.mid"
            className="min-w-0 flex-1 rounded-full bg-secondary px-5 py-3 text-sm text-foreground shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] outline-none placeholder:text-muted-foreground focus:shadow-[rgb(18,18,18)_0px_1px_0px,rgb(255,255,255)_0px_0px_0px_1px_inset]"
          />
          <button
            type="submit"
            disabled={addWatchPath.isPending}
            className="rounded-full bg-secondary px-5 py-3 text-sm font-bold uppercase tracking-[1.4px] text-foreground transition hover:bg-dark-card disabled:cursor-not-allowed disabled:opacity-60"
          >
            监听路径
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {(watchPaths?.paths ?? []).map((item) => (
            <span
              key={item}
              className="max-w-full truncate rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground"
              title={item}
            >
              {item}
            </span>
          ))}
        </div>
        {message ? (
          <p className="mt-3 text-sm font-bold text-near-white">{message}</p>
        ) : null}
        {isError ? (
          <p className="mt-3 text-sm font-bold text-destructive">
            {error instanceof Error ? error.message : '无法连接本地后端'}
          </p>
        ) : null}
      </section>

      <section className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
        {pieces.length > 0 ? (
          pieces.map((piece) => <PieceCard key={piece.id} piece={piece} />)
        ) : (
          <div className="rounded-lg bg-card p-5 text-sm text-muted-foreground shadow-medium">
            还没有 MIDI 曲目。添加一个包含 .mid 或 .midi 文件的本地路径。
          </div>
        )}
      </section>
    </div>
  )
}
