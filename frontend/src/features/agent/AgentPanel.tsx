import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Fingerprint,
  ListTree,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Fragment, useState, type ComponentProps } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { fingeringApi } from '../../api/fingering'
import { pieceStagesApi, type PieceStage, type PieceStagePlan } from '../../api/pieceStages'
import type { FingeringPatch, PieceScore } from '../../shared/types/domain'

type AgentPanelProps = {
  score?: PieceScore
}

type FingeringTarget = {
  planId: string
  stageId: string
}

type PlanDraft = {
  mode: 'create' | 'edit'
  name: string
  prompt: string
}

type AnalyzePlanInput = {
  planId?: string
  name: string
  prompt: string
}

export function AgentPanel({ score }: AgentPanelProps) {
  const queryClient = useQueryClient()
  const pieceId = score?.pieceId ?? ''
  const plansQueryKey = ['piece-stage-plans', pieceId] as const
  const [selectedStageId, setSelectedStageId] = useState('')
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const plansQuery = useQuery({
    queryKey: plansQueryKey,
    queryFn: () => pieceStagesApi.list(pieceId),
    enabled: Boolean(pieceId),
  })
  const plans = plansQuery.data ?? []
  const activePlan = plans.find((plan) => plan.isActive) ?? plans[0] ?? null
  const selectedStage = selectStage(activePlan, selectedStageId)

  const analyzePlan = useMutation({
    mutationFn: (input: AnalyzePlanInput) => pieceStagesApi.analyze(
      pieceId,
      input.planId,
      input.name,
      input.prompt,
    ),
    onSuccess: async (nextPlan) => {
      queryClient.setQueryData<PieceStagePlan[]>(plansQueryKey, (current = []) => {
        const remaining = current.filter((plan) => plan.id !== nextPlan.id)
        return [nextPlan, ...remaining.map((plan) => ({ ...plan, isActive: false }))]
      })
      setSelectedStageId('')
      setDraft(null)
      setConfirmingDelete(false)
      await queryClient.invalidateQueries({ queryKey: ['piece-score', pieceId] })
    },
  })
  const activatePlan = useMutation({
    mutationFn: (planId: string) => pieceStagesApi.activate(pieceId, planId),
    onSuccess: async (activated) => {
      queryClient.setQueryData<PieceStagePlan[]>(plansQueryKey, (current = []) =>
        current.map((plan) => ({ ...plan, isActive: plan.id === activated.id })),
      )
      setSelectedStageId('')
      setDraft(null)
      setConfirmingDelete(false)
      await queryClient.invalidateQueries({ queryKey: ['piece-score', pieceId] })
    },
  })
  const deletePlan = useMutation({
    mutationFn: (planId: string) => pieceStagesApi.delete(pieceId, planId),
    onSuccess: async () => {
      setSelectedStageId('')
      setDraft(null)
      setConfirmingDelete(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: plansQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['piece-score', pieceId] }),
      ])
    },
  })
  const fingering = useMutation({
    mutationFn: (target: FingeringTarget) => fingeringApi.generate(
      pieceId,
      target.planId,
      target.stageId,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['piece-score', pieceId] })
    },
  })

  const selectStageById = (stageId: string) => {
    setSelectedStageId((selectedId) => selectedId === stageId ? '' : stageId)
    fingering.reset()
  }
  const openCreate = () => {
    setDraft({ mode: 'create', name: `方案 ${plans.length + 1}`, prompt: '' })
    setConfirmingDelete(false)
    analyzePlan.reset()
  }
  const openEdit = () => {
    if (!activePlan) return
    setDraft({
      mode: 'edit',
      name: activePlan.name,
      prompt: activePlan.segmentationPrompt,
    })
    setConfirmingDelete(false)
    analyzePlan.reset()
  }
  const submitDraft = () => {
    if (!draft?.name.trim()) return
    analyzePlan.mutate({
      planId: draft.mode === 'edit' ? activePlan?.id : undefined,
      name: draft.name.trim(),
      prompt: draft.prompt.trim(),
    })
  }

  const busy = analyzePlan.isPending || activatePlan.isPending || deletePlan.isPending
  const error = analyzePlan.error
    ?? activatePlan.error
    ?? deletePlan.error
    ?? plansQuery.error

  return (
    <aside className="border border-border bg-card">
      <TooltipProvider delayDuration={180}>
        <header className="border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <ListTree className="size-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-[9px] font-bold tracking-[0.24em] text-muted-foreground">结构分析与动作规划</p>
                <h2 className="mt-0.5 text-xs font-bold text-foreground">分段 Agent</h2>
              </div>
            </div>
            <span className="text-[8px] font-bold tabular-nums text-muted-foreground">
              {plans.length} 方案
            </span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem] gap-1 border-t border-border p-2">
            <Select
              value={activePlan?.id ?? ''}
              disabled={!plans.length || busy}
              onValueChange={(planId) => {
                if (planId !== activePlan?.id) activatePlan.mutate(planId)
              }}
            >
              <SelectTrigger className="h-8 border-0 bg-accent/40 px-2.5 focus-visible:ring-1" aria-label="当前分段方案">
                <SelectValue placeholder={plansQuery.isLoading ? '正在读取方案' : '尚无分段方案'} />
              </SelectTrigger>
              <SelectContent align="start">
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} · G{plan.generation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <IconAction
              label="编辑当前方案"
              disabled={!activePlan || busy}
              onClick={openEdit}
            >
              <Pencil className="size-3.5" />
            </IconAction>
            <IconAction label="新建分段方案" disabled={!score || busy} onClick={openCreate}>
              <Plus className="size-3.5" />
            </IconAction>
          </div>
        </header>

        {draft ? (
          <PlanEditor
            draft={draft}
            plan={draft.mode === 'edit' ? activePlan : null}
            pending={analyzePlan.isPending}
            deleting={deletePlan.isPending}
            confirmingDelete={confirmingDelete}
            onChange={setDraft}
            onSubmit={submitDraft}
            onCancel={() => {
              setDraft(null)
              setConfirmingDelete(false)
            }}
            onRequestDelete={() => setConfirmingDelete(true)}
            onDelete={() => activePlan && deletePlan.mutate(activePlan.id)}
          />
        ) : null}

        {error ? <ErrorLine error={error} /> : null}

        <StageList
          plan={activePlan}
          selectedStage={selectedStage}
          generation={fingering}
          loading={plansQuery.isLoading || activatePlan.isPending}
          disabled={busy}
          onCreate={openCreate}
          onSelectStage={selectStageById}
          onGenerate={() => activePlan && selectedStage && fingering.mutate({
            planId: activePlan.id,
            stageId: selectedStage.id,
          })}
        />
      </TooltipProvider>
    </aside>
  )
}

function IconAction({
  label,
  children,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="grid size-8 place-items-center border border-border text-muted-foreground outline-none transition hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35"
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function PlanEditor({
  draft,
  plan,
  pending,
  deleting,
  confirmingDelete,
  onChange,
  onSubmit,
  onCancel,
  onRequestDelete,
  onDelete,
}: {
  draft: PlanDraft
  plan: PieceStagePlan | null
  pending: boolean
  deleting: boolean
  confirmingDelete: boolean
  onChange: (draft: PlanDraft) => void
  onSubmit: () => void
  onCancel: () => void
  onRequestDelete: () => void
  onDelete: () => void
}) {
  return (
    <section aria-labelledby="plan-editor-title" className="border-b border-border bg-accent/20">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-[8px] font-bold tracking-[0.2em] text-muted-foreground">
            {draft.mode === 'create' ? '新建方案' : `G${plan?.generation ?? 1} · 重新生成`}
          </p>
          <h3 id="plan-editor-title" className="mt-0.5 text-[11px] font-bold text-foreground">
            {draft.mode === 'create' ? '分段方案配置' : plan?.name}
          </h3>
        </div>
        <IconAction label="关闭方案编辑" onClick={onCancel} disabled={pending || deleting}>
          <X className="size-3.5" />
        </IconAction>
      </div>

      <div className="space-y-3 p-4">
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-bold text-muted-foreground">方案名称</span>
          <input
            value={draft.name}
            maxLength={40}
            disabled={pending || deleting}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            className="h-9 w-full border border-border bg-background px-3 text-xs text-foreground outline-none transition focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-bold text-muted-foreground">分段 Prompt</span>
          <textarea
            value={draft.prompt}
            rows={4}
            maxLength={1000}
            disabled={pending || deleting}
            placeholder="例如：优先按照节奏型变化分段"
            onChange={(event) => onChange({ ...draft, prompt: event.target.value })}
            className="w-full resize-none border border-border bg-background px-3 py-2 text-[11px] leading-5 text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </label>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          {draft.mode === 'edit' ? (
            confirmingDelete ? (
              <button
                type="button"
                disabled={pending || deleting}
                onClick={onDelete}
                className="inline-flex h-8 items-center gap-1.5 border border-destructive px-2.5 text-[9px] font-bold text-destructive outline-none transition hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-40"
              >
                {deleting ? <LoaderCircle className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                确认删除
              </button>
            ) : (
              <IconAction label="删除当前方案" disabled={pending} onClick={onRequestDelete}>
                <Trash2 className="size-3.5" />
              </IconAction>
            )
          ) : null}
          <button
            type="button"
            disabled={!draft.name.trim() || pending || deleting}
            onClick={onSubmit}
            className="ml-auto inline-flex h-8 items-center gap-2 bg-foreground px-3 text-[9px] font-bold text-background outline-none transition hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          >
            {pending ? <LoaderCircle className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            {pending ? '正在分析' : draft.mode === 'create' ? '创建并分析' : '更新并分析'}
          </button>
        </div>
      </div>
    </section>
  )
}

function StageList({
  plan,
  selectedStage,
  generation,
  loading,
  disabled,
  onCreate,
  onSelectStage,
  onGenerate,
}: {
  plan: PieceStagePlan | null
  selectedStage: PieceStage | null
  generation: UseMutationResult<FingeringPatch, Error, FingeringTarget>
  loading: boolean
  disabled: boolean
  onCreate: () => void
  onSelectStage: (stageId: string) => void
  onGenerate: () => void
}) {
  if (loading) {
    return (
      <div className="grid h-24 place-items-center text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-label="正在读取分段方案" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="px-4 py-8 text-center">
        <Sparkles className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-[10px] text-muted-foreground">尚无分段方案</p>
        <button
          type="button"
          disabled={disabled}
          onClick={onCreate}
          className="mt-4 inline-flex h-8 items-center gap-2 border border-border px-3 text-[9px] font-bold text-foreground outline-none transition hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <Plus className="size-3" />
          创建首个方案
        </button>
      </div>
    )
  }

  return (
    <section aria-label={`${plan.name}分段`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-[8px] font-bold text-muted-foreground">G{plan.generation} · {plan.model}</span>
        <span className="text-[8px] font-bold tabular-nums text-muted-foreground">{plan.stages.length} 段</span>
      </div>
      <div className="divide-y divide-border">
        {plan.stages.map((stage, index) => {
          const selected = stage.id === selectedStage?.id
          return (
            <Fragment key={stage.id}>
              <button
                type="button"
                disabled={disabled}
                aria-expanded={selected}
                onClick={() => onSelectStage(stage.id)}
                className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2 px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-45 ${selected ? 'bg-foreground text-background' : 'hover:bg-accent'}`}
              >
                <span className={`pt-0.5 text-[9px] font-bold tabular-nums ${selected ? 'text-background/55' : 'text-muted-foreground'}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{stage.label}</span>
                  <span className={`mt-1 block text-[9px] leading-4 ${selected ? 'text-background/65' : 'text-muted-foreground'}`}>
                    {stage.reason}
                  </span>
                </span>
                <span className="flex items-center gap-1 pt-0.5 text-[9px] font-bold tabular-nums">
                  {stage.startMeasure}-{stage.endMeasure}
                  <ChevronRight
                    className={`size-3 transition-transform ${selected ? 'rotate-90' : ''}`}
                    aria-hidden="true"
                  />
                </span>
              </button>

              {selected ? (
                <StageFingeringPanel
                  stage={stage}
                  stageNumber={index + 1}
                  generation={generation}
                  onGenerate={onGenerate}
                />
              ) : null}
            </Fragment>
          )
        })}
      </div>
    </section>
  )
}

function StageFingeringPanel({
  stage,
  stageNumber,
  generation,
  onGenerate,
}: {
  stage: PieceStage
  stageNumber: number
  generation: UseMutationResult<FingeringPatch, Error, FingeringTarget>
  onGenerate: () => void
}) {
  return (
    <section
      aria-labelledby={`stage-fingering-title-${stage.id}`}
      className="border-l-2 border-primary bg-accent/35 px-4 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Fingerprint className="size-4 text-primary" aria-hidden="true" />
          <div>
            <p className="text-[9px] font-bold tracking-[0.18em] text-muted-foreground">
              分段 {String(stageNumber).padStart(2, '0')} / 指法建议
            </p>
            <h3 id={`stage-fingering-title-${stage.id}`} className="mt-0.5 text-xs font-bold text-foreground">
              本段指法
            </h3>
          </div>
        </div>
        <span className="text-[9px] font-bold text-muted-foreground">L1-L5 · R1-R5</span>
      </div>

      <div className="mt-4 border-l-2 border-primary pl-3">
        <p className="truncate text-xs font-bold text-foreground">{stage.label}</p>
        <p className="mt-1 text-[9px] font-bold tabular-nums text-muted-foreground">
          第 {stage.startMeasure}-{stage.endMeasure} 小节
        </p>
      </div>

      <button
        type="button"
        disabled={generation.isPending}
        onClick={onGenerate}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 bg-foreground px-4 text-[10px] font-bold text-background outline-none transition hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
      >
        {generation.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {generation.isPending ? '正在生成' : '生成或更新本段指法'}
      </button>

      {generation.data ? (
        <p className="mt-3 flex items-center gap-2 border-l-2 border-primary bg-primary/5 px-3 py-2 text-[10px] text-foreground/75">
          <Check className="size-3 shrink-0 text-primary" />
          已更新 {generation.data.updatedCount} 个音符
        </p>
      ) : null}
      {generation.error ? <ErrorLine error={generation.error} /> : null}
    </section>
  )
}

function ErrorLine({ error }: { error: unknown }) {
  return (
    <p className="m-4 flex gap-2 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-[10px] leading-5 text-destructive">
      <AlertTriangle className="mt-1 size-3 shrink-0" />
      {errorMessage(error)}
    </p>
  )
}

function selectStage(
  plan: PieceStagePlan | null,
  selectedStageId: string,
) {
  if (!plan?.stages.length) return null
  return plan.stages.find((stage) => stage.id === selectedStageId) ?? null
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Agent 操作失败'
}
