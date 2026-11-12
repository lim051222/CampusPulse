import { useState } from 'react'
import type { SimSource } from '../types'

export function SimPanel({
  sources,
  onToggle,
}: {
  sources: SimSource[]
  onToggle: (subsystem: string, enabled: boolean, seed: number, backfillHours: number) => Promise<void>
}) {
  const [seed, setSeed] = useState(42)
  const [backfillHours, setBackfillHours] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = async (subsystem: string, enabled: boolean) => {
    setBusy(subsystem)
    try {
      await onToggle(subsystem, enabled, seed, backfillHours)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Simulated campus data</h2>
        <span className="badge badge-simulated">SIMULATED DATA</span>
      </header>

      <p className="muted small">
        These subsystems have no sensor hardware on this build. Enable them for the admin demo:
        every generated row is stored with <code>source=simulated</code> and is never relabelled as
        real or mixed into a hardware chart without a banner.
      </p>

      <div className="controls">
        <label>
          seed
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <label>
          backfill hours (≤24)
          <input
            type="number"
            min={0}
            max={24}
            value={backfillHours}
            onChange={(e) => setBackfillHours(Number(e.target.value))}
          />
        </label>
      </div>

      <ul className="sim-list">
        {sources.map((source) => (
          <li key={source.subsystem}>
            <div>
              <strong>{source.subsystem}</strong>
              <p className="muted small">{source.requires_authorisation}</p>
              <p className="muted small">
                rate {source.rate_per_minute}/min · last generated {source.last_generated_at ?? 'never'}
              </p>
            </div>
            <button
              type="button"
              disabled={busy === source.subsystem}
              className={source.enabled ? 'active' : ''}
              onClick={() => void toggle(source.subsystem, !source.enabled)}
            >
              {source.enabled ? 'disable' : 'enable'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
