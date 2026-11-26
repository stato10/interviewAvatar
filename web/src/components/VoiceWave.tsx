import { useEffect, useRef } from 'react'

/**
 * The product's visual signature: a voice waveform.
 * `getLevel` is polled every animation frame (0..1) — the coach's audio level in the room,
 * the microphone level in the device check, or a synthetic "speaking" signal on the landing page.
 * Heights are written straight to the DOM so React never re-renders per frame.
 */
export function VoiceWave({
  getLevel,
  bars = 24,
  className = '',
  label,
}: {
  getLevel: () => number
  bars?: number
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const levelRef = useRef(getLevel)
  levelRef.current = getLevel

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const nodes = Array.from(el.children) as HTMLElement[]
    // Taller in the middle, like a voice envelope.
    const envelope = nodes.map((_, i) => Math.sin(((i + 0.5) / nodes.length) * Math.PI) ** 0.8)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let smoothed = 0

    const tick = (t: number) => {
      const target = Math.max(0, Math.min(1, levelRef.current()))
      smoothed += (target - smoothed) * 0.22
      nodes.forEach((node, i) => {
        const jitter = reduced ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(t / 140 + i * 1.7) * Math.cos(t / 230 + i * 0.6))
        const h = 0.08 + smoothed * envelope[i] * jitter * 0.92
        node.style.transform = `scaleY(${h.toFixed(3)})`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bars])

  return (
    <div ref={ref} className={`wave ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={!label}>
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  )
}
