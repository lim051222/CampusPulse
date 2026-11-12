import type { Insights } from '../types'
import { DurationValue } from './MetricValue'
import { SourceBadge } from './SourceBadge'

export function InsightsPanel({ insights }: { insights: Insights | null }) {
  if (!insights) return null

  const suggestions = insights.suggestions ?? []
  const insufficient = insights.reason === 'insufficient_data'

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Insights &amp; suggestions</h2>
        <span className="muted small">window {insights.window.hours}h</span>
      </header>

      {insufficient ? (
        <p className="empty">数据不足：窗口内数据点少于 5 个，无法生成建议。</p>
      ) : suggestions.length === 0 ? (
        <p className="empty">
          当前无建议（触发条件：疑似空闲且相对光照 &gt; 70% 持续 ≥ 10 分钟）
        </p>
      ) : (
        <ul className="suggestions">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.device_id}-${suggestion.kind}`}>
              <div className="suggestion-head">
                <strong>{suggestion.device_id}</strong>
                <span className="pill pill-warn">需人工确认</span>
                {suggestion.sources.map((source) => (
                  <SourceBadge key={source} source={source} />
                ))}
              </div>
              <p>{suggestion.text}</p>
              <p className="muted small">
                依据 {suggestion.basis.from ?? '—'} ~ {suggestion.basis.to ?? '—'} ·{' '}
                <DurationValue
                  seconds={suggestion.basis.seconds}
                  sources={suggestion.sources}
                />
              </p>
            </li>
          ))}
        </ul>
      )}

      {insights.devices.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Points</th>
              <th>Sources</th>
              <th>Alerts</th>
              <th>Unoccupied + bright</th>
            </tr>
          </thead>
          <tbody>
            {insights.devices.map((device) => (
              <tr key={device.device_id}>
                <td>{device.device_id}</td>
                <td>{device.data_points}</td>
                <td>
                  {device.sources.map((source) => (
                    <SourceBadge key={source} source={source} compact />
                  ))}
                </td>
                <td>{device.alerts}</td>
                <td>
                  <DurationValue
                    seconds={device.unoccupied_bright_seconds}
                    sources={device.sources}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="muted small">
        PIR only detects motion: “unoccupied_suspected” is not proof a room is empty. Every
        suggestion requires human confirmation and no control action is automated.
      </p>
    </section>
  )
}
