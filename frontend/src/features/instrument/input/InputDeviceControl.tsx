import { Check, Keyboard, Piano, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { connectMidiInput, disconnectMidiInput } from './midiInputApi'
import { useInstrumentStore } from './instrumentStore'
import { pianoInputBus } from './PianoInputBus'

export function InputDeviceControl() {
  const devices = useInstrumentStore((state) => state.devices)
  const activeDeviceId = useInstrumentStore((state) => state.activeDeviceId)
  const setActiveDevice = useInstrumentStore((state) => state.setActiveDevice)
  const setStatus = useInstrumentStore((state) => state.setStatus)
  const calibrateDevice = useInstrumentStore((state) => state.calibrateDevice)
  const [calibrating, setCalibrating] = useState(false)
  const [observedRange, setObservedRange] = useState<[number, number] | null>(null)
  const [lastPitch, setLastPitch] = useState<number | null>(null)
  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? devices[0]

  const selectDevice = async (deviceId: string) => {
    const device = devices.find((item) => item.id === deviceId)
    if (!device) return
    setCalibrating(false)
    setObservedRange(null)
    setLastPitch(null)
    setStatus('connecting')
    try {
      if (device.kind === 'midi-keyboard') await connectMidiInput(device.id)
      else await disconnectMidiInput()
      setActiveDevice(device.id)
      setStatus('connected')
    } catch (error) {
      setStatus('error')
      console.error('Unable to select piano input', error)
    }
  }

  const Icon = activeDevice.kind === 'midi-keyboard' ? Piano : Keyboard
  const specification = activeDevice.keyCount
    ? `${activeDevice.keyCount} 键`
    : '范围未校准'

  useEffect(() => {
    return pianoInputBus.subscribe((event) => {
      if (event.type !== 'noteOn' || event.sourceId !== activeDevice.id) return
      setLastPitch(event.pitch)
      if (!calibrating) return
      const rawPitch = event.rawPitch ?? event.pitch
      setObservedRange((range) =>
        range
          ? [Math.min(range[0], rawPitch), Math.max(range[1], rawPitch)]
          : [rawPitch, rawPitch],
      )
    })
  }, [activeDevice.id, calibrating])

  const finishCalibration = () => {
    if (!observedRange || observedRange[0] === observedRange[1]) return
    calibrateDevice(activeDevice.id, observedRange[0], observedRange[1])
    setCalibrating(false)
    setObservedRange(null)
  }

  const startCalibration = () => {
    setObservedRange(null)
    setLastPitch(null)
    setCalibrating(true)
  }

  return (
    <div className="rounded-lg bg-card p-4 shadow-medium">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-spotify-green">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-title font-bold text-foreground">钢琴输入设备</h2>
          <p className="mt-1 text-sm text-muted-foreground">全局输入设备，选择后将直接用于所有练习模式。</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1.5 text-xs font-bold text-muted-foreground">
          输入端口
          <select
            value={activeDevice.id}
            onChange={(event) => void selectDevice(event.target.value)}
            className="h-10 min-w-0 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:border-spotify-green"
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id} className="bg-secondary">
                {device.name}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-muted-foreground sm:text-right">
          <p className="font-bold text-foreground">{specification}</p>
          <p className="mt-1">{activeDevice.kind === 'midi-keyboard' ? (lastPitch === null ? '等待 MIDI 输入' : `最近输入 MIDI ${lastPitch}`) : '固定 C2–C7 映射'}</p>
        </div>
      </div>

      {activeDevice.kind === 'midi-keyboard' ? (
        <div className="mt-3 grid gap-3 rounded-md bg-secondary p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
            <p className="font-bold text-foreground">
              {calibrating ? '正在采集键盘范围' : activeDevice.calibrated ? '范围已保存' : '键盘范围未校准'}
            </p>
            <p className="mt-1 text-muted-foreground">
              {calibrating
                ? observedRange
                  ? `已采集 MIDI ${observedRange[0]}–${observedRange[1]}，请确认已按下最低键和最高键。`
                  : '请依次按下键盘最左和最右的琴键。'
                : activeDevice.calibrated
                  ? `最低 MIDI ${activeDevice.lowestPitch}，最高 MIDI ${activeDevice.highestPitch}，共 ${activeDevice.keyCount} 键。`
                  : '校准只用于确定显示音域，不影响 MIDI 输入。'}
            </p>
            </div>
          {calibrating ? (
            <button type="button" onClick={finishCalibration} disabled={!observedRange || observedRange[0] === observedRange[1]} className="flex h-9 items-center gap-2 rounded-md bg-spotify-green px-3 text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
              <Check className="size-4" />完成并保存
            </button>
          ) : (
            <button type="button" onClick={startCalibration} className="flex h-9 items-center gap-2 rounded-md bg-background px-3 text-xs font-bold text-foreground hover:bg-dark-card">
              <RotateCcw className="size-4" />{activeDevice.calibrated ? '重新校准' : '开始校准'}
            </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
