import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FolderPlus, Info, Library, RefreshCw, X } from 'lucide-react'
import { scoreApi } from '../api/score'
import { PieceCard } from '../features/library/PieceCard'
import { AsciiMediaBackground } from '../components/media/AsciiMediaBackground'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'

export function LibraryPage() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [confirmingPieceId, setConfirmingPieceId] = useState<string | null>(null)
  const [confirmingWatchPath, setConfirmingWatchPath] = useState<string | null>(null)

  const { data: pieces = [], isError, error } = useQuery({
    queryKey: ['pieces'],
    queryFn: scoreApi.listPieces,
  })
  const { data: watchPaths } = useQuery({
    queryKey: ['watch-paths'],
    queryFn: scoreApi.listWatchPaths,
  })
  const addWatchPaths = useMutation({
    mutationFn: scoreApi.addWatchPaths,
    onSuccess: (report) => {
      setMessage(
        `扫描 ${report.discoveredFiles} 个 MIDI，新增 ${report.registeredFiles} 首，更新 ${report.updatedFiles} 首`,
      )
      void queryClient.invalidateQueries({ queryKey: ['pieces'] })
      void queryClient.invalidateQueries({ queryKey: ['piece-score'] })
      void queryClient.invalidateQueries({ queryKey: ['watch-paths'] })
    },
    onError: (mutationError) => {
      setMessage(mutationError instanceof Error ? mutationError.message : '路径扫描失败')
    },
  })
  const removeWatchPath = useMutation({
    mutationFn: scoreApi.removeWatchPath,
    onSuccess: (_result, path) => {
      setConfirmingWatchPath(null)
      setMessage(`已停止监视：${path}`)
      void queryClient.invalidateQueries({ queryKey: ['watch-paths'] })
    },
    onError: (mutationError) => {
      setMessage(mutationError instanceof Error ? mutationError.message : '无法移除监视目录')
    },
  })
  const selectDirectories = useMutation({
    mutationFn: scoreApi.selectWatchDirectories,
    onSuccess: (paths) => {
      if (paths.length === 0) {
        setMessage('未选择文件夹')
        return
      }
      addWatchPaths.mutate(paths)
    },
    onError: (mutationError) => {
      setMessage(mutationError instanceof Error ? mutationError.message : '无法打开文件夹选择器')
    },
  })
  const refresh = useMutation({
    mutationFn: scoreApi.refreshLocalLibrary,
    onSuccess: (report) => {
      setMessage(
        `刷新成功：新发现 ${report.discoveredFiles} 个 MIDI，已同步 ${report.registeredFiles} 首。`
      )
      void queryClient.invalidateQueries({ queryKey: ['pieces'] })
      void queryClient.invalidateQueries({ queryKey: ['piece-score'] })
      void queryClient.invalidateQueries({ queryKey: ['watch-paths'] })
    },
    onError: (mutationError) => {
      setMessage(mutationError instanceof Error ? mutationError.message : '刷新失败')
    },
  })
  const removePiece = useMutation({
    mutationFn: (piece: (typeof pieces)[number]) => scoreApi.deletePiece(piece.id),
    onMutate: async (removedPiece) => {
      await queryClient.cancelQueries({ queryKey: ['pieces'] })
      const previousPieces = queryClient.getQueryData<typeof pieces>(['pieces'])
      queryClient.setQueryData(
        ['pieces'],
        (current: typeof pieces | undefined) =>
          current?.filter(
            (piece) =>
              piece.id !== removedPiece.id &&
              piece.sourcePath !== removedPiece.sourcePath,
          ) ?? [],
      )
      return { previousPieces }
    },
    onSuccess: (_result, removedPiece) => {
      setConfirmingPieceId(null)
      setMessage('已从曲库中移除。')
      queryClient.removeQueries({ queryKey: ['piece-score', removedPiece.id] })
    },
    onError: (mutationError, _removedPiece, context) => {
      if (context?.previousPieces) {
        queryClient.setQueryData(['pieces'], context.previousPieces)
      }
      setMessage(mutationError instanceof Error ? mutationError.message : '移除失败')
    },
  })

  const requestRemove = (piece: (typeof pieces)[number]) => {
    if (confirmingPieceId === piece.id) {
      removePiece.mutate(piece)
      return
    }
    setConfirmingPieceId(piece.id)
    setMessage(null)
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-background font-sans text-foreground/90">
      <AsciiMediaBackground
        src="/piano-loop.mp4"
        characterSet="blocks"
        cellWidth={10}
        color="currentColor"
        dither="bayer"
        blackPoint={0.08}
        whitePoint={0.62}
        gamma={0.9}
        className="pointer-events-none absolute inset-0 size-full object-cover text-foreground dark:opacity-50 opacity-60"
      />
      {/* Elegant organic ambient radial-gradient masking */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />

      {/* Main Structural Division */}
      <div className="relative z-10 flex size-full justify-between pl-14 pr-14 xl:pl-20 xl:pr-20">

        {/* Left Editorial Column: Left Aligned and Integrated */}
        <main className="flex h-full w-[40%] min-w-[360px] max-w-[480px] shrink-0 flex-col py-16 pr-8">

          {/* Top Title Group */}
          <div className="flex flex-col">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.4em] text-foreground/20">
              <span className="block h-[1px] w-6 bg-foreground/10"></span>
              <span>Warming Piano</span>
            </div>
            <h1 className="font-title text-5xl font-extrabold tracking-tighter text-foreground sm:text-6xl">
              钢琴曲库
            </h1>
            <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground max-w-sm">
              专为落键钢琴练习打造的个人曲库。<br />
              导入本地 MIDI 目录，自动解析生成极简下落音符谱面。
            </p>
          </div>

          <section className="mt-auto flex w-full flex-col gap-7">
            <div className="flex items-end justify-between gap-5">
              <div className="min-w-0">
                <h2 className="font-title text-lg font-bold tracking-tight text-foreground">
                  MIDI 文件夹
                </h2>
                <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-muted-foreground">
                  持续监听并同步 MIDI 曲目
                </p>
              </div>
              <button
                type="button"
                disabled={selectDirectories.isPending || addWatchPaths.isPending}
                onClick={() => selectDirectories.mutate()}
                className="flex h-9 shrink-0 items-center justify-center gap-2 border border-foreground/30 bg-transparent px-4 text-[10px] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-60"
              >
                <FolderPlus className="size-3.5" />
                <span>{watchPaths?.paths?.length ? '添加目录' : '选择目录'}</span>
              </button>
            </div>

            {!!watchPaths?.paths?.length && (
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  Watching
                </span>
                <div className="flex flex-col gap-1.5">
                  {watchPaths.paths.map((p) => (
                    <div key={p} className="flex min-w-0 items-center gap-3">
                      <span className="size-1 shrink-0 bg-primary" aria-hidden="true" />
                      <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground" title={p}>
                        {p}
                      </span>
                      <Popover
                        open={confirmingWatchPath === p}
                        onOpenChange={(open) => setConfirmingWatchPath(open ? p : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={removeWatchPath.isPending}
                            className="ml-auto grid size-5 shrink-0 place-items-center border-0 bg-transparent text-muted-foreground/45 transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-40"
                            aria-label={`停止监视 ${p}`}
                            title="停止监视"
                          >
                            <X className="size-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="end" className="w-64 p-4">
                          <p className="text-xs font-bold text-foreground">停止监视此目录？</p>
                          <p className="mt-2 truncate text-[10px] text-muted-foreground" title={p}>
                            {p}
                          </p>
                          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                            已导入的曲目和本地 MIDI 文件不会被删除。
                          </p>
                          <div className="mt-4 flex items-center justify-end gap-4">
                            <button
                              type="button"
                              onClick={() => setConfirmingWatchPath(null)}
                              className="border-0 bg-transparent text-[10px] font-bold tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => removeWatchPath.mutate(p)}
                              disabled={removeWatchPath.isPending}
                              className="h-8 bg-destructive px-3 text-[10px] font-bold tracking-widest text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
                            >
                              停止监视
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(message || isError) && (
              <div className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/80" />
                <p className="flex-1 text-muted-foreground">{message || (error instanceof Error ? error.message : '同步故障')}</p>
                {message && (
                  <button type="button" onClick={() => setMessage(null)} className="opacity-40 hover:opacity-100">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}

            <footer className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`size-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
                <span>刷新曲库</span>
              </button>
              <div className="flex items-baseline gap-2 uppercase">
                <span className="font-title text-base font-bold text-foreground">{pieces.length}</span>
                <span className="text-[9px] font-bold tracking-[0.22em] text-muted-foreground">Tracks</span>
              </div>
            </footer>
          </section>

        </main>

        {/* Right Pieces Column: Single Column, pushed completely to the right edge */}
        <aside className="flex h-full w-[360px] shrink-0 flex-col py-16 xl:w-[400px]">
          <header className="flex shrink-0 items-center justify-between pb-6 border-b border-border/20">
            <h2 className="font-title text-base font-bold tracking-[0.2em] text-foreground/75">
              REPERTOIRE
            </h2>
            <span className="rounded-full bg-foreground/[0.03] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground border border-border/20">
              {pieces.length} Pieces
            </span>
          </header>

          <div className="flex-1 overflow-y-auto no-scrollbar pt-6">
            {pieces.length > 0 ? (
              <div className="flex flex-col gap-4">
                {pieces.map((piece) => (
                    <PieceCard
                      key={piece.id}
                      piece={piece}
                      onRemove={requestRemove}
                      onCancelRemove={() => setConfirmingPieceId(null)}
                      confirmingRemove={confirmingPieceId === piece.id}
                      removing={
                        removePiece.isPending &&
                        removePiece.variables?.sourcePath === piece.sourcePath
                      }
                    />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center opacity-60">
                <div className="mb-6 rounded-full border border-border bg-foreground/[0.03] p-4">
                  <Library className="size-6 text-muted-foreground" />
                </div>
                <h3 className="font-title text-base tracking-[0.2em] text-foreground/60">
                  曲库空白
                </h3>
                <p className="mt-3 max-w-[200px] text-[10px] leading-relaxed tracking-widest text-muted-foreground">
                  从左侧琴房控制台<br />建立本地文件夹连接
                </p>
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  )
}
