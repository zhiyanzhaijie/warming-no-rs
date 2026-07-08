import { useQuery } from '@tanstack/react-query'
import { agentApi } from '../../api/agent'

export function AgentPanel() {
  const { data: suggestions = [] } = useQuery({
    queryKey: ['agent-suggestions'],
    queryFn: agentApi.listSuggestions,
  })

  return (
    <aside className="rounded-lg bg-card p-4 shadow-medium">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[1.6px] text-muted-foreground">
            Practice Agent
          </p>
          <h2 className="mt-1 font-title text-lg font-bold text-foreground">
            下一轮建议
          </h2>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-spotify-green">
          Local
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {suggestions.map((suggestion) => (
          <article
            key={suggestion.id}
            className="rounded-lg bg-secondary p-3 transition hover:bg-dark-card"
          >
            <h3 className="text-sm font-bold text-foreground">{suggestion.title}</h3>
            <p className="mt-2 text-sm leading-normal text-muted-foreground">
              {suggestion.detail}
            </p>
            <p className="mt-3 rounded-md bg-near-black px-3 py-2 text-xs leading-normal text-near-white shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
              {suggestion.evidence}
            </p>
          </article>
        ))}
      </div>
    </aside>
  )
}
