import { Keyboard, Piano } from 'lucide-react'
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
  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? devices[0]

  const selectDevice = async (deviceId: string) => {
    const device = devices.find((item) => item.id === deviceId)
    if (!device) return
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
    if (!calibrating) return
    return pianoInputBus.subscribe((event) => {
      if (event.type !== 'noteOn' || event.sourceId !== activeDevice.id) return
      setObservedRange((range) =>
        range
          ? [Math.min(range[0], event.pitch), Math.max(range[1], event.pitch)]
          : [event.pitch, event.pitch],
      )
    })
  }, [activeDevice.id, calibrating])

  const finishCalibration = () => {
    if (!observedRange || observedRange[0] === observedRange[1]) return
    calibrateDevice(activeDevice.id, observedRange[0], observedRange[1])
    setCalibrating(false)
    setObservedRange(null)
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-secondary px-3 text-xs font-bold text-muted-foreground">
      <Icon className="size-4 text-spotify-green" />
      <select
        value={activeDevice.id}
        onChange={(event) => void selectDevice(event.target.value)}
        className="max-w-36 bg-transparent text-foreground outline-none"
        aria-label="钢琴输入设备"
      >
        {devices.map((device) => (
          <option key={device.id} value={device.id} className="bg-secondary">
            {device.name}
          </option>
        ))}
      </select>
      <span className="whitespace-nowrap text-[10px] text-muted-foreground">{specification}</span>
      {activeDevice.kind === 'midi-keyboard' ? (
        calibrating ? (
          <>
            <span className="whitespace-nowrap text-[10px] text-spotify-green">
              {observedRange ? `${observedRange[0]}–${observedRange[1]}` : '按最低键和最高键'}
            </span>
            <button type="button" onClick={finishCalibration} disabled={!observedRange || observedRange[0] === observedRange[1]} className="font-bold text-foreground disabled:opacity-40">
              完成
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setCalibrating(true)} className="font-bold text-foreground">
            校准
          </button>
        )
      ) : null}
    </div>
  )
}
