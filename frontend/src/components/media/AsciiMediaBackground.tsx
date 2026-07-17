import { useEffect, useRef } from 'react'
import {
  AsciiMediaRenderer,
  type AsciiDither,
  type AsciiMediaType,
} from './asciiMediaRenderer'

export const ASCII_CHARACTER_SETS = {
  standard: ' .:-=+*#%@',
  minimal: ' .:+#',
  blocks: ' ░▒▓█',
} as const

export type AsciiCharacterSet = keyof typeof ASCII_CHARACTER_SETS

export interface AsciiMediaBackgroundProps {
  src: string
  characters?: string
  characterSet?: AsciiCharacterSet
  columns?: number
  cellWidth?: number
  color?: string
  backgroundColor?: string
  dither?: AsciiDither
  blackPoint?: number
  whitePoint?: number
  gamma?: number
  invert?: boolean
  loop?: boolean
  mediaType?: AsciiMediaType
  maxFramesPerSecond?: number
  className?: string
  onError?: (error: Error) => void
}

export function AsciiMediaBackground({
  src,
  characters,
  characterSet = 'standard',
  columns,
  cellWidth = 8,
  color = 'currentColor',
  backgroundColor = 'transparent',
  dither = 'bayer',
  blackPoint = 0,
  whitePoint = 1,
  gamma = 1,
  invert = false,
  loop = true,
  mediaType = 'auto',
  maxFramesPerSecond = 24,
  className,
  onError,
}: AsciiMediaBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resolvedCharacters = characters ?? ASCII_CHARACTER_SETS[characterSet]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new AsciiMediaRenderer(canvas, {
      src,
      characters: resolvedCharacters,
      columns,
      cellWidth,
      color,
      backgroundColor,
      dither,
      blackPoint,
      whitePoint,
      gamma,
      invert,
      loop,
      mediaType,
      maxFramesPerSecond,
      onError,
    })
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      renderer.resize(entry.contentRect.width, entry.contentRect.height)
    })
    resizeObserver.observe(canvas)

    return () => {
      resizeObserver.disconnect()
      renderer.destroy()
    }
  }, [
    backgroundColor,
    blackPoint,
    cellWidth,
    resolvedCharacters,
    color,
    columns,
    dither,
    gamma,
    invert,
    loop,
    maxFramesPerSecond,
    mediaType,
    onError,
    src,
    whitePoint,
  ])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
    />
  )
}
