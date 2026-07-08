import { useQuery } from '@tanstack/react-query'
import { practiceApi } from '../api/practice'

export function ReportsPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: practiceApi.listReports,
  })

  return (
    <div className="p-6 max-[720px]:p-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[1.8px] text-muted-foreground">
          Practice Reports
        </p>
        <h1 className="mt-2 font-title text-2xl font-bold text-foreground">
          练习报告
        </h1>
      </header>

      <section className="mt-5 grid gap-3">
        {reports.map((report) => (
          <article
            key={report.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg bg-card p-4 shadow-medium transition hover:bg-dark-card max-[720px]:grid-cols-1"
          >
            <div>
              <h2 className="font-title font-bold text-foreground">
                {report.pieceTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.date} · {report.focus}
              </p>
            </div>
            <div className="rounded-full bg-secondary px-3 py-1.5 text-sm font-bold text-foreground">
              准确率 {Math.round(report.accuracy * 100)}%
            </div>
            <div className="rounded-full bg-secondary px-3 py-1.5 text-sm font-bold text-spotify-green">
              节奏 {Math.round(report.timingScore * 100)}%
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
