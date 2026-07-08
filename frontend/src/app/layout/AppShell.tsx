import { NavLink, Outlet } from 'react-router-dom'
import { usePracticeStore } from '../../features/practice/practiceStore'

const navItems = [
  { to: '/library', label: '曲库', icon: '♬' },
  { to: '/practice', label: '练习', icon: '▶' },
  { to: '/reports', label: '报告', icon: '≡' },
  { to: '/settings', label: '设置', icon: '•' },
]

export function AppShell() {
  const connectedDevice = usePracticeStore((state) => state.connectedDevice)

  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="grid h-full grid-cols-[17rem_1fr] gap-2 p-2 max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_1fr]">
        <aside className="flex min-h-0 flex-col rounded-lg bg-near-black px-3 py-4 max-[900px]:rounded-b-none">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-spotify-green text-lg font-bold text-primary-foreground shadow-heavy">
              ▶
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1.8px] text-muted-foreground">
                Agent Piano
              </p>
              <h1 className="font-title text-2xl font-bold leading-none text-foreground">
                本地钢琴练习台
              </h1>
            </div>
          </div>

          <nav className="mt-8 grid gap-1 max-[900px]:mt-4 max-[900px]:grid-cols-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-3 rounded-full px-3 py-2.5 text-sm transition',
                    isActive
                      ? 'bg-secondary text-foreground shadow-medium font-bold'
                      : 'font-normal text-muted-foreground hover:bg-secondary hover:text-foreground',
                  ].join(' ')
                }
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-current/10 text-xs">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-lg bg-card p-4 shadow-medium max-[900px]:hidden">
            <p className="text-xs font-bold uppercase tracking-[1.6px] text-muted-foreground">
              MIDI 输入
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">{connectedDevice}</p>
            <div className="mt-4 h-1 rounded-full bg-muted">
              <div className="h-full w-3/5 rounded-full bg-spotify-green" />
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 overflow-y-auto rounded-lg bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
