import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { scoreApi } from '../api/score'
import { Button } from '@/components/ui/button'
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
import { TransportControls } from '../features/practice/TransportControls'
import { usePracticeStore } from '../features/practice/practiceStore'
import { InputDeviceControl } from '../features/instrument/input/InputDeviceControl'
import type { PracticeMode, ScoreNote } from '../shared/types/domain'

export function PracticePage() {
  const [params] = useSearchParams()
  const requestedPieceId = params.get('pieceId')
  const setBpm = usePracticeStore((state) => state.setBpm)
  const mode = usePracticeStore((state) => state.mode)
  const setMode = usePracticeStore((state) => state.setMode)
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
    if (score?.tempoBpm) {
      setBpm(score.tempoBpm)
    }
  }, [score?.tempoBpm, setBpm])

  useEffect(() => {
    if (mode !== 'listen' && pieceId) void refetchScore()
  }, [mode, pieceId, refetchScore])

  const availableModes = useMemo(
    () => buildAvailableModes(score?.notes ?? []),
    [score?.notes],
  )

  useEffect(() => {
    if (!availableModes.has(mode)) setMode('listen')
  }, [availableModes, mode, setMode])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3 max-[720px]:p-2">
      <header className="flex shrink-0 items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-medium max-[900px]:flex-wrap">
        <div className="min-w-[12rem] flex-1">
          <h1 className="truncate font-title text-base font-bold text-foreground">
            {score?.title ?? '下落音符练习'}
          </h1>
          <p className="truncate text-[10px] font-bold uppercase tracking-[1.8px] text-muted-foreground">
            Synthesia Practice
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <InputDeviceControl />
          <TransportControls compact availableModes={availableModes} />
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-10 rounded-full bg-secondary text-muted-foreground hover:text-foreground"
                aria-label="打开 Agent"
                title="打开 Agent"
              >
                <Bot className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="border-border bg-card p-0 text-foreground sm:max-w-md">
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="font-title text-base">Agent</SheetTitle>
                <SheetDescription>练习辅助与分析</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <AgentPanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <MeasureProgress score={score} />

      <div className="min-h-0 flex-1">
        <FallingNotes score={score} />
      </div>
    </div>
  )
}

function buildAvailableModes(
  notes: ScoreNote[],
) {
  const modes = new Set<PracticeMode>(['listen', 'free'])
  if (notes.some((note) => note.hand === 'left')) modes.add('left-hand')
  if (notes.some((note) => note.hand === 'right')) modes.add('right-hand')
  if (notes.length > 0) modes.add('both-hands')
  return modes
}
