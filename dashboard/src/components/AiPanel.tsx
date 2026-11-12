import { useState } from 'react'
import { api } from '../api'
import type { AiAnswer, DailySummary } from '../types'
import { SourceBadge } from './SourceBadge'

const SAMPLES = [
  '今天哪间教室有无人时还开灯的迹象？',
  '现在有哪些设备离线？',
  '总结今天的告警和节能建议',
  '今天有多少学生进过厕所？',
]

export function AiPanel() {
  const [question, setQuestion] = useState(SAMPLES[0])
  const [answer, setAnswer] = useState<AiAnswer | null>(null)
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      setAnswer(await api.ask(question))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const loadSummary = async () => {
    setBusy(true)
    setError(null)
    try {
      setSummary(await api.summary())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>AI operations assistant</h2>
        {answer && (
          <span className={`pill pill-${answer.mode === 'model' ? 'online' : 'warn'}`}>
            {answer.mode === 'model' ? 'LLM' : 'RULE-BASED'}
          </span>
        )}
      </header>

      <div className="controls ai-controls">
        <select value={question} onChange={(e) => setQuestion(e.target.value)}>
          {SAMPLES.map((sample) => (
            <option key={sample} value={sample}>
              {sample}
            </option>
          ))}
        </select>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="ask about the stored data"
        />
        <button type="button" disabled={busy} onClick={() => void ask()}>
          ask
        </button>
        <button type="button" disabled={busy} onClick={() => void loadSummary()}>
          daily summary
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {busy && <p className="muted">thinking…</p>}

      {answer && (
        <div className="answer">
          <pre>{answer.answer}</pre>
          {answer.citations.length > 0 && (
            <ul className="citations">
              {answer.citations.map((citation) => (
                <li key={`${citation.device_id}-${citation.metrics.join(',')}`}>
                  <strong>{citation.device_id}</strong> · {citation.metrics.join(', ')} ·{' '}
                  {citation.from ?? '—'} ~ {citation.to ?? '—'}{' '}
                  {citation.sources.map((source) => (
                    <SourceBadge key={source} source={source} compact />
                  ))}
                </li>
              ))}
            </ul>
          )}
          {answer.notes && <p className="muted small">{answer.notes}</p>}
        </div>
      )}

      {summary && (
        <div className="summary">
          <h3>Daily summary · {summary.windows_hours}h</h3>
          <dl className="metrics-grid">
            <div>
              <dt>Alerts</dt>
              <dd>{summary.alerts}</dd>
            </div>
            <div>
              <dt>Unoccupied + bright</dt>
              <dd>{Math.round(summary.unoccupied_bright_seconds / 60)} min</dd>
            </div>
            <div>
              <dt>Online / offline</dt>
              <dd>
                {summary.devices_online} / {summary.devices_offline}
              </dd>
            </div>
            <div>
              <dt>Simulated share</dt>
              <dd>{Math.round(summary.simulated_device_share * 100)}%</dd>
            </div>
          </dl>
          <p className="muted small">{summary.notes}</p>
        </div>
      )}
    </section>
  )
}
