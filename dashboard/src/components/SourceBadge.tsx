import type { Source } from '../types'

export function SourceBadge({ source, compact = false }: { source: Source; compact?: boolean }) {
  const label = source === 'simulated' ? 'SIMULATED' : 'REAL'
  return (
    <span className={`badge badge-${source}${compact ? ' badge-compact' : ''}`} title={`data source: ${source}`}>
      {label}
    </span>
  )
}
