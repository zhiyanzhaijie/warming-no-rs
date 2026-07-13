import { Bot, Database, FolderCog, Globe2, HardDrive, Languages, Laptop, Moon, ShieldCheck, Sun } from 'lucide-react'
import { InputDeviceControl } from '../features/instrument/input/InputDeviceControl'
import { useThemeStore, type ThemePreference } from '../features/settings/themeStore'
import { cn } from '@/lib/utils'

const localRuntime = [
  {
    label: '数据目录',
    value: '~/Library/Application Support/Agent Piano',
    detail: '曲库索引与本地配置',
    icon: FolderCog,
  },
  {
    label: '向量数据库',
    value: 'sqlite-vec local index',
    detail: '仅保存在本机',
    icon: Database,
  },
  {
    label: '智能服务',
    value: 'Remote API for MVP',
    detail: '练习分析通道',
    icon: Bot,
  },
]

export function SettingsPage() {
  const themePreference = useThemeStore((state) => state.preference)
  const setThemePreference = useThemeStore((state) => state.setPreference)

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground/90">
      <header className="flex min-h-24 shrink-0 items-center justify-between gap-6 border-b border-border px-8 py-5 max-[720px]:min-h-20 max-[720px]:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 text-[9px] font-bold tracking-[0.35em] text-muted-foreground">
            <span className="h-px w-6 bg-border" />
            本地控制台
          </div>
          <div className="mt-2 flex min-w-0 items-baseline gap-4">
            <h1 className="shrink-0 font-title text-2xl font-bold text-foreground/95">本地设置</h1>
            <p className="truncate text-xs tracking-wide text-muted-foreground max-[640px]:hidden">
              管理演奏输入与本地运行环境
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-bold tracking-[0.2em] text-primary">
          <ShieldCheck className="size-3.5" />
          本机配置
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_19rem] max-[920px]:grid-cols-1 max-[920px]:overflow-y-auto">
        <main className="min-h-0 min-w-0 overflow-y-auto max-[920px]:min-h-[760px]">
          <div className="min-h-[520px] border-b border-border">
            <InputDeviceControl />
          </div>
          <PreferencesPanel
            themePreference={themePreference}
            onThemeChange={setThemePreference}
          />
        </main>

        <aside className="flex min-h-0 flex-col border-l border-border max-[920px]:border-l-0 max-[920px]:border-t">
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <HardDrive className="size-4 text-muted-foreground" />
              <p className="text-[9px] font-bold tracking-[0.32em] text-muted-foreground">运行环境</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">应用使用的本地服务与存储位置</p>
          </div>

          <dl className="flex-1 px-6 py-2">
            {localRuntime.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="border-b border-border py-5 last:border-b-0">
                  <dt className="flex items-center gap-3 text-[9px] font-bold tracking-[0.24em] text-muted-foreground">
                    <Icon className="size-3.5" />
                    {item.label}
                  </dt>
                  <dd className="mt-3 break-words text-xs font-bold leading-5 text-foreground/65">{item.value}</dd>
                  <dd className="mt-1 text-[10px] tracking-wide text-muted-foreground">{item.detail}</dd>
                </div>
              )
            })}
          </dl>

          <div className="border-t border-border px-6 py-5 text-[10px] leading-5 tracking-wide text-muted-foreground">
            输入设备设置即时生效，并由当前设备保存在本机。MIDI 校准不会修改原始设备数据。
          </div>
        </aside>
      </div>
    </div>
  )
}

const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'system', label: '跟随系统', icon: Laptop },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

function PreferencesPanel({
  themePreference,
  onThemeChange,
}: {
  themePreference: ThemePreference
  onThemeChange: (preference: ThemePreference) => void
}) {
  return (
    <section aria-labelledby="preference-title" className="px-8 py-7 max-[720px]:px-5">
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center border border-border text-muted-foreground">
          <Globe2 className="size-4" />
        </div>
        <div>
          <h2 id="preference-title" className="font-title text-base font-bold text-foreground/90">主题与语言</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">设置应用外观与界面语言偏好。</p>
        </div>
      </div>

      <div className="mt-6 grid max-w-2xl gap-5">
        <fieldset>
          <legend className="text-[9px] font-bold tracking-[0.28em] text-muted-foreground">主题偏好</legend>
          <div className="mt-2 grid grid-cols-3 gap-px border border-border bg-border max-[520px]:grid-cols-1">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const selected = option.value === themePreference
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onThemeChange(option.value)}
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 bg-background px-3 text-xs font-bold outline-none transition focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary',
                    selected ? 'text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <p className="text-[9px] font-bold tracking-[0.28em] text-muted-foreground">语言偏好</p>
          <button
            type="button"
            disabled
            className="mt-2 flex h-12 w-full items-center justify-between border border-border px-4 text-xs text-muted-foreground opacity-50"
          >
            <span className="flex items-center gap-3"><Languages className="size-3.5" />简体中文</span>
            <span className="text-[9px] font-bold tracking-[0.2em]">尚未开放</span>
          </button>
        </div>
      </div>
    </section>
  )
}
