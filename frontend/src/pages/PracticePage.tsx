import { AgentPanel } from '../features/agent/AgentPanel'
import { FallingNotes } from '../features/performance/FallingNotes'
import { TransportControls } from '../features/practice/TransportControls'

export function PracticePage() {
  return (
    <div className="grid gap-4 p-6 max-[720px]:p-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[1.8px] text-muted-foreground">
          Synthesia Practice
        </p>
        <h1 className="mt-2 font-title text-2xl font-bold text-foreground">
          下落音符练习
        </h1>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_22rem] gap-4 max-[1180px]:grid-cols-1">
        <div className="grid gap-4">
          <FallingNotes />
          <TransportControls />
        </div>
        <AgentPanel />
      </div>
    </div>
  )
}
