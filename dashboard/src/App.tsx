import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from './api'
import { AiPanel } from './components/AiPanel'
import { CommandFeed } from './components/CommandFeed'
import { DeviceCard } from './components/DeviceCard'
import { InsightsPanel } from './components/InsightsPanel'
import { SimPanel } from './components/SimPanel'
import { TrendChart } from './components/TrendChart'
import { SourceBadge } from './components/SourceBadge'
import type { CommandRecord, Device, Health, Insights, SimSource } from './types'

const POLL_MS = 5000

export default function App() {
  const [devices, setDevices] = useState<Device[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [simSources, setSimSources] = useState<SimSource[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [lastCommand, setLastCommand] = useState<CommandRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [healthResult, deviceResult, insightResult, simResult] = await Promise.all([
        api.health(),
        api.devices(),
        api.insights(24),
        api.simSources(),
      ])
      setHealth(healthResult)
      setDevices(deviceResult.items)
      setInsights(insightResult)
      setSimSources(simResult.items)
      setUpdatedAt(new Date().toLocaleTimeString())
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const commandTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (commandTimer.current) window.clearInterval(commandTimer.current)
    },
    [],
  )

  const sendCommand = useCallback(
    async (deviceId: string, type: string, args: Record<string, unknown> = {}) => {
      setBusy(true)
      setError(null)
      try {
        const created = await api.command(deviceId, type, args)
        setLastCommand(created)

        if (commandTimer.current) window.clearInterval(commandTimer.current)
        const startedAt = Date.now()
        commandTimer.current = window.setInterval(() => {
          void api
            .history(deviceId)
            .then((history) => {
              const found = history.items.find((item) => item.id === created.id)
              if (found) setLastCommand(found)
              const finished = found !== undefined && found.status !== 'pending'
              if (finished || Date.now() - startedAt > 30000) {
                if (commandTimer.current) window.clearInterval(commandTimer.current)
                commandTimer.current = null
              }
            })
            .catch(() => undefined)
        }, 2000)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const toggleSim = useCallback(
    async (subsystem: string, enabled: boolean, seed: number, backfillHours: number) => {
      await api.toggleSim(subsystem, {
        enabled,
        seed,
        backfill_hours: backfillHours,
        rate_per_minute: 6,
      })
      await refresh()
    },
    [refresh],
  )

  const realDevices = devices.filter((device) => device.source === 'real')
  const simulatedDevices = devices.filter((device) => device.source === 'simulated')

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>CampusPulse · School Admin</h1>
          <p className="muted">
            Smart campus operations · every value carries its data source
          </p>
        </div>
        <div className="app-status">
          <span className={`pill pill-${health ? 'online' : 'offline'}`}>
            {health ? 'API OK' : 'API DOWN'}
          </span>
          <span className="pill pill-warn">{health?.ai_enabled ? 'LLM ENABLED' : 'RULE-BASED AI'}</span>
          <span className="muted small">refreshed {updatedAt || '—'}</span>
        </div>
      </header>

      {error && <p className="banner banner-error">Backend error: {error}</p>}

      <section className="panel">
        <header className="panel-head">
          <h2>Live devices</h2>
          <span className="muted small">{realDevices.length} hardware node(s)</span>
        </header>
        {realDevices.length === 0 ? (
          <p className="empty">
            No hardware has reported yet. Check Wi-Fi credentials, the API base URL and that the
            node is powered.
          </p>
        ) : (
          <div className="card-grid">
            {realDevices.map((device) => (
              <DeviceCard key={device.device_id} device={device} onCommand={sendCommand} busy={busy} />
            ))}
          </div>
        )}
        <CommandFeed command={lastCommand} />
      </section>

      {simulatedDevices.length > 0 && (
        <section className="panel">
          <header className="panel-head">
            <h2>Simulated devices</h2>
            <span className="badge badge-simulated">SIMULATED</span>
          </header>
          <div className="card-grid">
            {simulatedDevices.map((device) => (
              <DeviceCard key={device.device_id} device={device} onCommand={sendCommand} busy={busy} />
            ))}
          </div>
        </section>
      )}

      <TrendChart devices={devices} />
      <InsightsPanel insights={insights} />
      <SimPanel sources={simSources} onToggle={toggleSim} />
      <AiPanel />

      <footer className="app-foot">
        <p className="muted small">
          Safety notes: PIR only detects motion (never headcount) · relative light is not calibrated
          lux · the relay is limited to low-voltage DC loads and never mains · simulated data is
          always labelled and never relabelled as real. <SourceBadge source="real" compact />
        </p>
        <p className="muted small">
          Point the firmware at this backend with <code>API_BASE_URL</code> in
          <code>firmware/campuspulse_node/secrets.h</code>.
        </p>
      </footer>
    </div>
  )
}
