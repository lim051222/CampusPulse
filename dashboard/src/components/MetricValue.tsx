/* The only place numbers are formatted. The `source` prop is required, so a value can
   never reach the screen without its provenance. ESLint bans `toFixed` elsewhere. */
import type { LatestValue, Source } from '../types'
import { SourceBadge } from './SourceBadge'

interface MetricValueProps {
  value: LatestValue | undefined
  digits?: number
  unit?: string
}

export function MetricValue({ value, digits = 1, unit = '' }: MetricValueProps) {
  if (!value || (value.value_num === null && value.value_text === null)) {
    return (
      <span className="metric metric-empty">
        --<span className="metric-hint"> no data</span>
      </span>
    )
  }

  const text =
    value.value_num !== null ? `${value.value_num.toFixed(digits)}${unit}` : String(value.value_text)

  return (
    <span className="metric">
      <span className="metric-value">{text}</span>
      <SourceBadge source={value.source} compact />
    </span>
  )
}

export function DurationValue({
  seconds,
  sources,
}: {
  seconds: number
  sources: Source[]
}) {
  const minutes = seconds / 60
  const text = minutes >= 1 ? `${minutes.toFixed(1)} min` : `${seconds.toFixed(0)} s`
  return (
    <span className="metric">
      <span className="metric-value">{text}</span>
      {sources.map((source) => (
        <SourceBadge key={source} source={source} compact />
      ))}
    </span>
  )
}
