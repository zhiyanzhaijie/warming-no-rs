export type AsciiDither = 'none' | 'bayer'
export type AsciiMediaType = 'auto' | 'image' | 'video'

export interface AsciiMediaOptions {
  src: string
  characters: string
  columns?: number
  cellWidth: number
  color: string
  backgroundColor: string
  dither: AsciiDither
  blackPoint: number
  whitePoint: number
  gamma: number
  invert: boolean
  loop: boolean
  mediaType: AsciiMediaType
  maxFramesPerSecond: number
  onError?: (error: Error) => void
}

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const

const MIN_COLUMNS = 8
const MAX_COLUMNS = 320
const MONOSPACE_CHARACTER_RATIO = 0.6015625
const FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

type MediaElement = HTMLImageElement | HTMLVideoElement

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function resolveMediaType(src: string, mediaType: AsciiMediaType): Exclude<AsciiMediaType, 'auto'> {
  if (mediaType !== 'auto') return mediaType

  const pathname = src.split(/[?#]/, 1)[0]?.toLowerCase() ?? ''
  return /\.(?:gif|png|apng|jpe?g|webp|avif)$/.test(pathname) ? 'image' : 'video'
}

function getSourceSize(media: MediaElement) {
  if (media instanceof HTMLVideoElement) {
    return { width: media.videoWidth, height: media.videoHeight }
  }

  return { width: media.naturalWidth, height: media.naturalHeight }
}

function resolveCanvasColor(canvas: HTMLCanvasElement, color: string) {
  const computedStyle = getComputedStyle(canvas)
  if (color === 'currentColor') return computedStyle.color

  const customProperty = color.match(/^var\((--[\w-]+)\)$/)?.[1]
  return customProperty
    ? computedStyle.getPropertyValue(customProperty).trim() || color
    : color
}

function drawCover(
  context: CanvasRenderingContext2D,
  media: MediaElement,
  destinationWidth: number,
  destinationHeight: number,
) {
  const source = getSourceSize(media)
  if (source.width === 0 || source.height === 0) return false

  const sourceRatio = source.width / source.height
  const destinationRatio = destinationWidth / destinationHeight
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = source.width
  let sourceHeight = source.height

  if (sourceRatio > destinationRatio) {
    sourceWidth = source.height * destinationRatio
    sourceX = (source.width - sourceWidth) / 2
  } else {
    sourceHeight = source.width / destinationRatio
    sourceY = (source.height - sourceHeight) / 2
  }

  context.drawImage(
    media,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    destinationWidth,
    destinationHeight,
  )
  return true
}

export class AsciiMediaRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly sampleCanvas = document.createElement('canvas')
  private readonly sampleContext: CanvasRenderingContext2D
  private readonly media: MediaElement
  private readonly characters: string[]
  private readonly options: AsciiMediaOptions
  private readonly mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly intersectionObserver: IntersectionObserver
  private animationFrameId: number | null = null
  private videoFrameId: number | null = null
  private width = 0
  private height = 0
  private isReady = false
  private isVisible = true
  private hasFailed = false
  private isDestroyed = false
  private lastImageFrameAt = 0
  private lastVideoFrameAt = 0

  constructor(canvas: HTMLCanvasElement, options: AsciiMediaOptions) {
    const context = canvas.getContext('2d')
    const sampleContext = this.sampleCanvas.getContext('2d', { willReadFrequently: true })
    if (!context || !sampleContext) {
      throw new Error('当前环境不支持 Canvas 2D')
    }

    this.canvas = canvas
    this.context = context
    this.sampleContext = sampleContext
    this.options = options
    this.characters = Array.from(options.characters || ' ')
    this.media = this.createMedia(resolveMediaType(options.src, options.mediaType))
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry?.isIntersecting ?? false
        this.updatePlayback()
      },
      { threshold: 0 },
    )

    this.intersectionObserver.observe(canvas)
    document.addEventListener('visibilitychange', this.updatePlayback)
    this.mediaQuery.addEventListener('change', this.updatePlayback)
  }

  resize(width: number, height: number) {
    this.width = Math.max(0, width)
    this.height = Math.max(0, height)

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const pixelWidth = Math.max(1, Math.round(this.width * pixelRatio))
    const pixelHeight = Math.max(1, Math.round(this.height * pixelRatio))
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
    }

    this.renderFrame()
  }

  destroy() {
    this.isDestroyed = true
    this.cancelScheduledFrame()
    this.intersectionObserver.disconnect()
    document.removeEventListener('visibilitychange', this.updatePlayback)
    this.mediaQuery.removeEventListener('change', this.updatePlayback)

    if (this.media instanceof HTMLVideoElement) {
      this.media.removeEventListener('loadeddata', this.handleMediaReady)
      this.media.removeEventListener('error', this.handleMediaError)
      this.media.pause()
      this.media.removeAttribute('src')
      this.media.load()
    } else {
      this.media.removeEventListener('load', this.handleMediaReady)
      this.media.removeEventListener('error', this.handleMediaError)
      this.media.src = ''
    }
  }

  private createMedia(mediaType: Exclude<AsciiMediaType, 'auto'>): MediaElement {
    if (mediaType === 'image') {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.decoding = 'async'
      image.addEventListener('load', this.handleMediaReady, { once: true })
      image.addEventListener('error', this.handleMediaError, { once: true })
      image.src = this.options.src
      return image
    }

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.loop = this.options.loop
    video.addEventListener('loadeddata', this.handleMediaReady, { once: true })
    video.addEventListener('error', this.handleMediaError, { once: true })
    video.src = this.options.src
    video.load()
    return video
  }

  private readonly handleMediaReady = () => {
    if (this.isDestroyed) return
    this.isReady = true
    this.renderFrame()
    this.updatePlayback()
  }

  private readonly handleMediaError = () => {
    if (this.isDestroyed) return
    this.fail(new Error(`无法加载 ASCII 背景素材：${this.options.src}`))
  }

  private readonly updatePlayback = () => {
    if (!this.isReady || this.hasFailed) return

    if (!this.shouldAnimate()) {
      this.cancelScheduledFrame()
      if (this.media instanceof HTMLVideoElement) this.media.pause()
      this.renderFrame()
      return
    }

    if (this.media instanceof HTMLVideoElement) {
      void this.media.play().then(
        () => {
          if (this.shouldAnimate()) this.scheduleVideoFrame()
        },
        () => this.fail(new Error('浏览器阻止了 ASCII 背景视频自动播放')),
      )
      return
    }

    this.scheduleImageFrame()
  }

  private scheduleVideoFrame() {
    if (
      !this.shouldAnimate()
      || this.videoFrameId !== null
      || this.animationFrameId !== null
      || !(this.media instanceof HTMLVideoElement)
    ) return

    const frameDuration = 1000 / clamp(this.options.maxFramesPerSecond, 1, 60)
    const renderIfDue = (now: number) => {
      if (now - this.lastVideoFrameAt < frameDuration) return
      this.lastVideoFrameAt = now
      this.renderFrame()
    }

    if ('requestVideoFrameCallback' in this.media) {
      this.videoFrameId = this.media.requestVideoFrameCallback((now) => {
        this.videoFrameId = null
        renderIfDue(now)
        this.scheduleVideoFrame()
      })
      return
    }

    this.animationFrameId = window.requestAnimationFrame(() => {
      this.animationFrameId = null
      renderIfDue(performance.now())
      this.scheduleVideoFrame()
    })
  }

  private scheduleImageFrame() {
    if (!this.shouldAnimate() || this.animationFrameId !== null) return

    const frameDuration = 1000 / clamp(this.options.maxFramesPerSecond, 1, 60)
    const tick = (now: number) => {
      this.animationFrameId = null
      if (now - this.lastImageFrameAt >= frameDuration) {
        this.lastImageFrameAt = now
        this.renderFrame()
      }
      if (this.shouldAnimate()) this.scheduleImageFrame()
    }

    this.animationFrameId = window.requestAnimationFrame(tick)
  }

  private cancelScheduledFrame() {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.videoFrameId !== null && this.media instanceof HTMLVideoElement) {
      this.media.cancelVideoFrameCallback?.(this.videoFrameId)
      this.videoFrameId = null
    }
  }

  private renderFrame() {
    if (!this.isReady || this.width === 0 || this.height === 0 || this.hasFailed) return

    const fixedCellWidth = clamp(this.options.cellWidth, 2, 64)
    const columns = this.options.columns === undefined
      ? Math.max(1, Math.floor(this.width / fixedCellWidth))
      : Math.round(clamp(this.options.columns, MIN_COLUMNS, MAX_COLUMNS))
    const cellWidth = this.options.columns === undefined
      ? fixedCellWidth
      : this.width / columns
    const fontSize = cellWidth / MONOSPACE_CHARACTER_RATIO
    const cellHeight = fontSize
    const rows = Math.max(1, Math.ceil(this.height / cellHeight))

    if (this.sampleCanvas.width !== columns || this.sampleCanvas.height !== rows) {
      this.sampleCanvas.width = columns
      this.sampleCanvas.height = rows
    }
    this.sampleContext.clearRect(0, 0, columns, rows)

    try {
      if (!drawCover(this.sampleContext, this.media, columns, rows)) return
      const pixels = this.sampleContext.getImageData(0, 0, columns, rows).data
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const context = this.context
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, this.width, this.height)

      if (this.options.backgroundColor !== 'transparent') {
        context.fillStyle = resolveCanvasColor(this.canvas, this.options.backgroundColor)
        context.fillRect(0, 0, this.width, this.height)
      }

      context.fillStyle = resolveCanvasColor(this.canvas, this.options.color)
      context.font = `${fontSize}px ${FONT_STACK}`
      context.textBaseline = 'top'

      const characterCount = this.characters.length
      const maxCharacterIndex = characterCount - 1
      const blackPoint = clamp(this.options.blackPoint, 0, 0.99)
      const whitePoint = clamp(this.options.whitePoint, blackPoint + 0.01, 1)
      const gamma = clamp(this.options.gamma, 0.1, 4)
      for (let row = 0; row < rows; row += 1) {
        let line = ''
        for (let column = 0; column < columns; column += 1) {
          const pixelIndex = (row * columns + column) * 4
          const red = pixels[pixelIndex] ?? 0
          const green = pixels[pixelIndex + 1] ?? 0
          const blue = pixels[pixelIndex + 2] ?? 0
          const alpha = (pixels[pixelIndex + 3] ?? 0) / 255
          let luminance = ((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255) * alpha
          luminance = Math.pow(
            clamp((luminance - blackPoint) / (whitePoint - blackPoint), 0, 1),
            gamma,
          )

          if (this.options.dither === 'bayer' && characterCount > 1) {
            const threshold = (BAYER_4X4[(row % 4) * 4 + (column % 4)] + 0.5) / 16 - 0.5
            luminance = clamp(luminance + threshold / characterCount, 0, 1)
          }
          if (this.options.invert) luminance = 1 - luminance

          const characterIndex = Math.round(luminance * maxCharacterIndex)
          line += this.characters[characterIndex] ?? ' '
        }
        context.fillText(line, 0, row * cellHeight)
      }
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error('ASCII 背景渲染失败'))
    }
  }

  private fail(error: Error) {
    if (this.hasFailed || this.isDestroyed) return
    this.hasFailed = true
    this.cancelScheduledFrame()
    this.options.onError?.(error)
  }

  private shouldAnimate() {
    return this.isVisible
      && !document.hidden
      && !this.mediaQuery.matches
      && !this.hasFailed
      && !this.isDestroyed
  }
}
