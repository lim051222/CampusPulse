import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../api'
import type { Device, Reading } from '../types'
import { SourceBadge } from './SourceBadge'

const METRICS = [
  'temperature_c',
  'humidity_pct',
  'light_rel_pct',
  'occupancy',
  'ap_clients',
  'ap_latency_ms',
  'ap_loss_pct',
]

const RANGES = {
  '1h': 1,
  '24h': 24,
  '7d': 24 * 7,
} as const

type RangeKey = keyof typeof RANGES

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString()
}

export function TrendChart({ devices }: { devices: Device[] }) {
  const [deviceId, setDeviceId] = useState('')
  const [metric, setMetric] = useState('temperature_c')
  const [range, setRange] = useState<RangeKey>('1h')
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!deviceId && devices.length > 0) {
      setDeviceId(devices[0].device_id)
    }
  }, [devices, deviceId])

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.readings({
        device_id: deviceId,
        metric,
        from: hoursAgo(RANGES[range]),
        limit: 5000,
      })
      setReadings(result.items)
    } catch (err) {
      setError((err as Error).message)
      setReadings([])
    } finally {
      setLoading(false)
    }
  }, [deviceId, metric, range])

  useEffect(() => {
    void load()
  }, [load])

  const points = useMemo(
    () =>
      readings
        .filter((reading) => reading.value_num !== null)
        .map((reading) => ({
          t: Date.parse(reading.ts),
          value: reading.value_num as number,
        })),
    [readings],
  )

  const sources = useMemo(() => Array.from(new Set(readings.map((r) => r.source))), [readings])
  const mixed = sources.length > 1
  const simulatedCount = readings.filter((r) => r.source === 'simulated').length
  const simulatedShare = readings.length ? Math.round((simulatedCount / readings.length) * 100) : 0

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>History</h2>
        <div className="controls">
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((device) => (
              <option key={device.device_id} value={device.device_id}>
                {device.name ?? device.device_id}
              </option>
            ))}
          </select>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="segmented">
            {(Object.keys(RANGES) as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={range === key ? 'active' : ''}
                onClick={() => setRange(key)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </header>

      {mixed && (
        <p className="banner banner-warn">
          Mixed sources in this chart: {simulatedShare}% simulated. Real and simulated series are
          labelled below and must not be read as one dataset.
        </p>
      )}

      <div className="chart-source">
        {sources.length === 0 ? (
          <span className="muted small">no data</span>
        ) : (
          sources.map((source) => <SourceBadge key={source} source={source} />)
        )}
      </div>

      {loading && <p className="muted">loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && points.length === 0 ? (
        <p className="empty">该区间暂无数据</p>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#26303d" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value: number) => new Date(value).toLocaleTimeString()}
                stroke="#7d8b9c"
              />
              <YAxis stroke="#7d8b9c" width={56} />
              <Tooltip
                labelFormatter={(value) => new Date(Number(value)).toLocaleString()}
                contentStyle={{ background: '#131a24', border: '1px solid #26303d' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4ea1ff"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
