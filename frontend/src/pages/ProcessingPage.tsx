import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Check,
  FileAudio,
  FileMusic,
  FolderOutput,
  LoaderCircle,
  RefreshCw,
  Upload,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { transcriptionApi, type SelectedAudioFile } from '../api/transcription'
import { cn } from '@/lib/utils'

const workflow = [
  '检测转换引擎',
  '选择钢琴音频',
  '指定保存位置',
  '完成本地转写',
]

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
  const currentStep = outputPath ? 4 : generate.isPending ? 3 : file ? 2 : ready ? 1 : 0
  const statusDetail = transkun.data?.detail
    ?? (transkun.error instanceof Error ? transkun.error.message : '正在确认本地 Python 环境。')

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#030303] text-white/90">
      <header className="flex min-h-24 shrink-0 items-center justify-between gap-6 border-b border-white/10 px-8 py-5 max-[720px]:min-h-20 max-[720px]:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 text-[9px] font-bold tracking-[0.35em] text-white/25">
            <span className="h-px w-6 bg-white/15" />
            音频工作台
          </div>
          <div className="mt-2 flex min-w-0 items-baseline gap-4">
            <h1 className="shrink-0 font-title text-2xl font-bold text-white/95">音频加工</h1>
            <p className="truncate text-xs tracking-wide text-white/35 max-[640px]:hidden">
              将钢琴录音转写为可用于练习的 MIDI 文件
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void transkun.refetch()}
          disabled={transkun.isFetching || generate.isPending}
          className="grid size-9 shrink-0 place-items-center border border-white/10 text-white/40 transition hover:border-white/35 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="重新检测转换引擎"
          title="重新检测转换引擎"
        >
          <RefreshCw className={cn('size-3.5', transkun.isFetching && 'animate-spin')} />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_19rem] max-[920px]:grid-cols-1 max-[920px]:overflow-y-auto">
        <main className="flex min-h-0 min-w-0 flex-col max-[920px]:min-h-[620px]">
          <section className="flex shrink-0 items-start gap-4 border-b border-white/10 px-8 py-5 max-[720px]:px-5">
            <div
              className={cn(
                'grid size-9 shrink-0 place-items-center border text-white/35',
                ready ? 'border-primary/50 text-primary' : 'border-white/10',
              )}
            >
              {transkun.isFetching ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : ready ? (
                <Check className="size-4" />
              ) : (
                <Wrench className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <h2 className="text-sm font-bold text-white/90">
                  {transkun.isFetching
                    ? '正在检测 TransKun'
                    : ready
                      ? '转换引擎已就绪'
                      : '需要安装 TransKun'}
                </h2>
                <span className={cn(
                  'text-[9px] font-bold tracking-[0.22em]',
                  ready ? 'text-primary' : 'text-white/25',
                )}>
                  {ready ? '本地可用' : '等待检测'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/35">{statusDetail}</p>
              {transkun.data?.command ? (
                <code className="mt-2 block truncate text-[10px] tracking-wide text-white/25">
                  {transkun.data.command}
                </code>
              ) : null}
            </div>
          </section>

          <button
            type="button"
            disabled={!ready || selectFile.isPending || generate.isPending}
            onClick={() => selectFile.mutate()}
            className="group relative flex min-h-64 flex-1 items-center justify-center overflow-hidden border-b border-white/10 px-8 py-10 text-left transition hover:bg-white/[0.025] disabled:cursor-not-allowed disabled:opacity-40 max-[720px]:px-5"
          >
            <span className="pointer-events-none absolute inset-x-8 top-1/2 h-px bg-white/[0.04] max-[720px]:inset-x-5" />
            <span className="pointer-events-none absolute inset-y-8 left-1/2 w-px bg-white/[0.04]" />
            <div className="relative z-10 flex w-full max-w-2xl items-center gap-6 border border-white/10 bg-[#030303] px-6 py-7 transition group-hover:border-white/30 max-[600px]:items-start max-[600px]:gap-4 max-[600px]:px-4">
              <div className="grid size-12 shrink-0 place-items-center border border-white/15 text-white/45 transition group-hover:border-primary/60 group-hover:text-primary">
                {selectFile.isPending ? <LoaderCircle className="size-5 animate-spin" /> : file ? <FileAudio className="size-5" /> : <Upload className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold tracking-[0.3em] text-white/25">
                  {file ? '当前音频' : '输入文件'}
                </p>
                <p className="mt-2 truncate font-title text-lg font-bold text-white/90" title={file?.name}>
                  {file?.name ?? '选择钢琴音频'}
                </p>
                {file ? (
                  <>
                    <p className="mt-1 text-xs tracking-wide text-white/40">
                      {formatBytes(file.sizeBytes)} · {(file.name.split('.').pop() ?? '音频').toUpperCase()}
                    </p>
                    <p className="mt-3 truncate text-[10px] tracking-wide text-white/25" title={file.path}>
                      {file.path}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-white/35">
                    支持 MP3、FLAC、WAV、M4A、AAC、OGG 与 Opus
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[9px] font-bold tracking-[0.2em] text-white/25 transition group-hover:text-white/70 max-[600px]:hidden">
                {file ? '更换文件' : '浏览文件'}
              </span>
            </div>
          </button>

          <section className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 px-8 py-5 max-[720px]:grid-cols-1 max-[720px]:px-5">
            <div className="min-w-0">
              {outputPath ? (
                <div className="flex min-w-0 items-center gap-3 text-primary">
                  <FileMusic className="size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-wide">MIDI 已生成</p>
                    <p className="mt-1 truncate text-[10px] text-white/35" title={outputPath}>{outputPath}</p>
                  </div>
                </div>
              ) : message ? (
                <p className="text-xs font-bold text-destructive">{message}</p>
              ) : (
                <div className="flex items-center gap-3 text-white/30">
                  <FolderOutput className="size-4 shrink-0" />
                  <p className="text-[10px] leading-5 tracking-wide">
                    生成时选择保存位置，源文件不会被修改
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!ready || !file || generate.isPending}
              onClick={() => file && generate.mutate(file.path)}
              className="h-10 min-w-56 border border-primary bg-primary px-5 text-[10px] font-bold tracking-[0.18em] text-black transition hover:bg-transparent hover:text-primary disabled:border-white/10 disabled:bg-transparent disabled:text-white/20 max-[720px]:w-full"
            >
              {generate.isPending ? `正在生成 · ${formatDuration(elapsed)}` : '选择保存位置并生成 MIDI'}
            </button>
          </section>
        </main>

        <aside className="flex min-h-0 flex-col border-l border-white/10 max-[920px]:border-l-0 max-[920px]:border-t">
          <div className="border-b border-white/10 px-6 py-5">
            <p className="text-[9px] font-bold tracking-[0.32em] text-white/25">处理流程</p>
            <p className="mt-2 text-xs leading-5 text-white/35">所有转写均在本机完成</p>
          </div>
          <ol className="flex-1 px-6 py-3">
            {workflow.map((label, index) => {
              const step = index + 1
              const completed = currentStep >= step
              const active = currentStep + 1 === step
              return (
                <li key={label} className="relative flex min-h-16 gap-4 border-b border-white/[0.07] py-4 last:border-b-0">
                  <span className={cn(
                    'grid size-6 shrink-0 place-items-center border text-[9px] font-bold',
                    completed
                      ? 'border-primary/60 text-primary'
                      : active
                        ? 'border-white/35 text-white/75'
                        : 'border-white/10 text-white/20',
                  )}>
                    {completed ? <Check className="size-3" /> : step.toString().padStart(2, '0')}
                  </span>
                  <div className="pt-0.5">
                    <p className={cn(
                      'text-xs font-bold tracking-wide',
                      completed ? 'text-white/65' : active ? 'text-white/90' : 'text-white/25',
                    )}>
                      {label}
                    </p>
                    {active ? <p className="mt-1 text-[9px] tracking-widest text-primary">当前步骤</p> : null}
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="border-t border-white/10 px-6 py-5 text-[10px] leading-5 tracking-wide text-white/25">
            转写耗时取决于音频时长与电脑性能。处理期间可以切换页面，任务会在后台继续运行。
          </div>
        </aside>
      </div>
    </div>
  )
}
