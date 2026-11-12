import type { Device } from '../types'
import { MetricValue } from './MetricValue'
import { SourceBadge } from './SourceBadge'

const MODES = ['energy', 'occupancy', 'countdown', 'checkin'] as const

export function DeviceCard({
  device,
  onCommand,
  busy,
}: {
  device: Device
  onCommand: (deviceId: string, type: string, args?: Record<string, unknown>) => void
  busy: boolean
}) {
  const latest = device.latest

  return (
    <article className={`card${device.status === 'offline' ? ' card-offline' : ''}`}>
      <header className="card-head">
        <div>
          <h3>{device.name ?? device.device_id}</h3>
          <p className="muted">
            {device.device_id}
            {device.room ? ` · ${device.room}` : ''}
            {device.mode ? ` · mode ${device.mode}` : ''}
          </p>
        </div>
        <div className="badges">
          <span className={`pill pill-${device.status}`}>{device.status.toUpperCase()}</span>
          <SourceBadge source={device.source} />
        </div>
      </header>

      <dl className="metrics-grid">
        <div>
          <dt>Temperature</dt>
          <dd><MetricValue value={latest.temperature_c} digits={1} unit=" °C" /></dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd><MetricValue value={latest.humidity_pct} digits={0} unit=" %" /></dd>
        </div>
        <div>
          <dt>Relative light</dt>
          <dd><MetricValue value={latest.light_rel_pct} digits={0} unit=" %" /></dd>
        </div>
        <div>
          <dt>Occupancy</dt>
          <dd><MetricValue value={latest.occupancy} /></dd>
        </div>
        <div>
          <dt>Relay</dt>
          <dd><MetricValue value={latest.relay} /></dd>
        </div>
        <div>
          <dt>Pass count</dt>
          <dd><MetricValue value={latest.pass_count} digits={0} /></dd>
        </div>
      </dl>

      {device.faults.length > 0 && (
        <ul className="faults">
          {device.faults.map((fault) => (
            <li key={fault}>{fault}</li>
          ))}
        </ul>
      )}

      <footer>
        <p className="muted small">last seen {device.last_seen ?? '—'} ({device.age_seconds}s ago)</p>
        <div className="actions">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={busy || device.source === 'simulated'}
              className={device.mode === mode ? 'active' : ''}
              onClick={() => onCommand(device.device_id, 'set_mode', { mode })}
            >
              {mode}
            </button>
          ))}
          <button type="button" disabled={busy} onClick={() => onCommand(device.device_id, 'mute_alarm', { minutes: 5 })}>
            mute 5m
          </button>
          <button type="button" disabled={busy} onClick={() => onCommand(device.device_id, 'force_relay_off')}>
            relay off
          </button>
        </div>
        {device.source === 'simulated' && (
          <p className="muted small">Simulated device — commands are not sent to hardware.</p>
        )}
      </footer>
    </article>
  )
}
