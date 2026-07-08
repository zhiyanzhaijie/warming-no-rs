export function SettingsPage() {
  return (
    <div className="p-6 max-[720px]:p-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[1.8px] text-muted-foreground">
          Local Settings
        </p>
        <h1 className="mt-2 font-title text-2xl font-bold text-foreground">
          本地设置
        </h1>
      </header>

      <section className="mt-5 grid max-w-3xl gap-3">
        {[
          ['MIDI 输入设备', 'Local MIDI Device'],
          ['数据目录', '~/Library/Application Support/Agent Piano'],
          ['向量数据库', 'sqlite-vec local index'],
          ['LLM 模式', 'Remote API for MVP'],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 rounded-lg bg-card p-4 shadow-medium max-[640px]:items-start"
          >
            <div>
              <h2 className="font-title font-bold text-foreground">{label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{value}</p>
            </div>
            <button className="rounded-full bg-secondary px-4 py-2 text-sm font-bold uppercase tracking-[1.4px] text-foreground hover:bg-dark-card">
              配置
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
