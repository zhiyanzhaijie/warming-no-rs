import { useQuery } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { scoreApi } from '../api/score'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AgentPanel } from '../features/agent/AgentPanel'
import { FallingNotes } from '../features/performance/FallingNotes'
import { MeasureProgress } from '../features/practice/MeasureProgress'
import { PlaybackCluster, TransportControls } from '../features/practice/TransportControls'
import { usePracticeStore } from '../features/practice/practiceStore'
import { usePracticeShortcuts } from '../features/practice/usePracticeShortcuts'
import type { PracticeMode, ScoreNote } from '../shared/types/domain'

export function PracticePage() {
  const [params] = useSearchParams()
  const requestedPieceId = params.get('pieceId')
  const setBpm = usePracticeStore((state) => state.setBpm)
  const mode = usePracticeStore((state) => state.mode)
  const setMode = usePracticeStore((state) => state.setMode)
  const [consoleExpanded, setConsoleExpanded] = useState(true)
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)

  const { data: pieces = [] } = useQuery({
    queryKey: ['pieces'],
    queryFn: scoreApi.listPieces,
  })
  const pieceId = requestedPieceId ?? pieces[0]?.id
  const { data: score, refetch: refetchScore } = useQuery({
    queryKey: ['piece-score', pieceId],
    queryFn: () => scoreApi.getPieceScore(pieceId ?? ''),
    enabled: Boolean(pieceId),
  })

  useEffect(() => {
    if (score?.tempoBpm) setBpm(score.tempoBpm)
  }, [score?.tempoBpm, setBpm])

  useEffect(() => {
    if (mode !== 'listen' && pieceId) void refetchScore()
  }, [mode, pieceId, refetchScore])

  const availableModes = useMemo(
    () => buildAvailableModes(score?.notes ?? []),
    [score?.notes],
  )
  usePracticeShortcuts(
    availableModes,
    () => setAgentPanelOpen((open) => !open),
  )

  useEffect(() => {
    if (!availableModes.has(mode)) setMode('listen')
  }, [availableModes, mode, setMode])

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
        {consoleExpanded ? (
        <div className="relative flex min-h-16 items-center px-5 lg:px-8">
          <div className="min-w-0 max-w-[24%]">
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-muted-foreground">
              练习演奏
            </p>
            <h1 className="mt-1 truncate font-title text-lg font-bold tracking-tight text-foreground/90">
              {score?.title ?? '下落音符练习'}
            </h1>
          </div>

          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 max-[860px]:hidden">
            <PlaybackCluster />
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
            <div className="max-[860px]:hidden">
              <TransportControls compact availableModes={availableModes} />
            </div>
            <Sheet open={agentPanelOpen} onOpenChange={setAgentPanelOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="grid size-8 place-items-center border border-border text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
                  aria-label="打开智能助手"
                  title="打开智能助手"
                >
                  <Bot className="size-3.5" />
                </button>
              </SheetTrigger>
              <SheetContent className="border-l border-border bg-background/95 p-0 text-foreground backdrop-blur-xl sm:max-w-md">
                <SheetHeader className="border-b border-border px-6 py-5">
                  <p className="text-[9px] font-bold tracking-[0.3em] text-muted-foreground">练习助手</p>
                  <SheetTitle className="font-title text-base text-foreground/90">演奏分析</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">练习辅助与音准节拍诊断</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <AgentPanel />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        ) : null}

        {consoleExpanded ? (
          <div className="hidden border-t border-border px-5 py-3 max-[860px]:block">
            <TransportControls compact availableModes={availableModes} />
          </div>
        ) : null}
        <MeasureProgress
          score={score}
          expanded={consoleExpanded}
          onToggleExpanded={() => setConsoleExpanded((expanded) => !expanded)}
        />
      </header>

      <main className="min-h-0 flex-1">
        <FallingNotes score={score} />
      </main>
    </div>
  )
}

function buildAvailableModes(notes: ScoreNote[]) {
  const modes = new Set<PracticeMode>(['listen', 'free'])
  if (notes.some((note) => note.hand === 'left')) modes.add('left-hand')
  if (notes.some((note) => note.hand === 'right')) modes.add('right-hand')
  if (notes.length > 0) modes.add('both-hands')
  return modes
}
