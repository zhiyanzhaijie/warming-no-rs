import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, FileAudio, FileMusic, LoaderCircle, RefreshCw, Upload, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { transcriptionApi, type SelectedAudioFile } from '../api/transcription'

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export function ProcessingPage() {
  const [file, setFile] = useState<SelectedAudioFile | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  const transkun = useQuery({
    queryKey: ['transkun-status'],
    queryFn: transcriptionApi.checkTranskun,
    retry: false,
  })
  const selectFile = useMutation({
    mutationFn: transcriptionApi.selectAudio,
    onSuccess: (selected) => {
      if (!selected) return
      setFile(selected)
      setOutputPath(null)
      setMessage(null)
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : '无法选择文件'),
  })
  const generate = useMutation({
    mutationFn: transcriptionApi.generateMidi,
    onMutate: () => {
      setElapsed(0)
      setMessage(null)
      setOutputPath(null)
    },
    onSuccess: (result) => {
      if (!result) {
        setMessage('已取消保存，未开始转换。')
        return
      }
      setOutputPath(result.outputPath)
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'MIDI 生成失败'),
  })

  useEffect(() => {
    if (!generate.isPending) return
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [generate.isPending])

  const ready = transkun.data?.available === true

  return (
    <div className="h-full overflow-y-auto p-6 max-[720px]:p-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.8px] text-muted-foreground">Audio Workshop</p>
          <h1 className="mt-2 font-title text-2xl font-bold text-foreground">音频加工</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">将钢琴音频转写为可用于练习的 MIDI 文件。</p>
        </div>
        <button
          type="button"
          onClick={() => void transkun.refetch()}
          disabled={transkun.isFetching || generate.isPending}
          className="grid size-10 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-dark-card disabled:opacity-50"
          aria-label="重新检测 TransKun"
          title="重新检测 TransKun"
        >
          <RefreshCw className={`size-4 ${transkun.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_18rem] gap-5 max-[900px]:grid-cols-1">
        <section className="min-w-0">
          <div className={`flex items-start gap-3 rounded-lg p-4 shadow-medium ${ready ? 'bg-card' : 'bg-secondary'}`}>
            <div className={`grid size-10 shrink-0 place-items-center rounded-full ${ready ? 'bg-spotify-green text-primary-foreground' : 'bg-dark-card text-muted-foreground'}`}>
              {transkun.isFetching ? <LoaderCircle className="size-5 animate-spin" /> : ready ? <Check className="size-5" /> : <Wrench className="size-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-title font-bold">{transkun.isFetching ? '正在检测 TransKun' : ready ? '转换引擎已就绪' : '需要安装 TransKun'}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{transkun.data?.detail ?? (transkun.error instanceof Error ? transkun.error.message : '正在确认本地 Python 环境。')}</p>
              {transkun.data?.command ? <code className="mt-2 block truncate text-xs text-near-white">{transkun.data.command}</code> : null}
            </div>
          </div>

          <button
            type="button"
            disabled={!ready || selectFile.isPending || generate.isPending}
            onClick={() => selectFile.mutate()}
            className="mt-4 flex min-h-44 w-full items-center justify-center rounded-lg bg-card p-5 text-left shadow-medium transition hover:bg-dark-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex max-w-full items-center gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-full bg-secondary text-spotify-green"><Upload className="size-6" /></div>
              <div className="min-w-0">
                <p className="font-title text-lg font-bold">{file ? '更换音频文件' : '选择音频文件'}</p>
                <p className="mt-1 text-sm text-muted-foreground">支持 MP3、FLAC、WAV、M4A、AAC、OGG、Opus 等常见格式。</p>
              </div>
            </div>
          </button>

          {file ? (
            <div className="mt-4 flex min-w-0 items-center gap-3 rounded-lg bg-card p-4 shadow-medium">
              <FileAudio className="size-6 shrink-0 text-spotify-green" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold" title={file.name}>{file.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={file.path}>{formatBytes(file.sizeBytes)} · {file.path}</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase text-muted-foreground">{file.name.split('.').pop() ?? 'audio'}</span>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!ready || !file || generate.isPending}
            onClick={() => file && generate.mutate(file.path)}
            className="mt-5 w-full rounded-full bg-spotify-green px-6 py-3 text-sm font-bold uppercase tracking-[1.4px] text-primary-foreground shadow-heavy transition hover:bg-spotify-green-hover disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
          >
            {generate.isPending ? `正在生成 ${formatDuration(elapsed)}` : '选择保存位置并生成 MIDI'}
          </button>

          {message ? <p className="mt-3 text-sm font-bold text-destructive">{message}</p> : null}
          {outputPath ? (
            <div className="mt-4 flex min-w-0 items-center gap-3 rounded-lg bg-card p-4 shadow-medium">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-spotify-green text-primary-foreground"><FileMusic className="size-5" /></div>
              <div className="min-w-0"><p className="font-bold">MIDI 已生成</p><p className="mt-1 truncate text-xs text-muted-foreground" title={outputPath}>{outputPath}</p></div>
            </div>
          ) : null}
        </section>

        <aside className="rounded-lg bg-card p-5 shadow-medium">
          <p className="text-xs font-bold uppercase tracking-[1.6px] text-muted-foreground">处理流程</p>
          <ol className="mt-4 grid gap-5">
            {['检测本地 TransKun', '选择钢琴音频', '指定 MIDI 保存位置', '等待本地转写完成'].map((label, index) => (
              <li key={label} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-near-white">{index + 1}</span><span className="pt-0.5 text-sm font-bold">{label}</span></li>
            ))}
          </ol>
          <div className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            转写耗时取决于音频时长与电脑性能。处理期间请保持应用开启；源文件只在本机读取，不会被修改。
          </div>
        </aside>
      </div>
    </div>
  )
}
