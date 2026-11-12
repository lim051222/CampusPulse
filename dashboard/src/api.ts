import type {
  AiAnswer,
  CommandRecord,
  DailySummary,
  Device,
  Health,
  Insights,
  Reading,
  SimSource,
} from './types'

// Empty base = same origin, which is what the Vite dev proxy uses.
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${response.status} ${text.slice(0, 200)}`)
  }
  return (await response.json()) as T
}

function post<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(json<T>)
}

export const api = {
  health: () => fetch(`${BASE}/healthz`).then(json<Health>),

  devices: () => fetch(`${BASE}/api/v1/devices`).then(json<{ items: Device[]; count: number }>),

  readings: (params: {
    device_id?: string
    metric?: string
    from?: string
    to?: string
    limit?: number
  }) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value))
    })
    return fetch(`${BASE}/api/v1/readings?${query.toString()}`).then(
      json<{ items: Reading[]; count: number; truncated: boolean }>,
    )
  },

  insights: (hours = 24) =>
    fetch(`${BASE}/api/v1/insights?hours=${hours}`).then(json<Insights>),

  command: (deviceId: string, type: string, args: Record<string, unknown> = {}) =>
    post<CommandRecord>(`/api/v1/devices/${deviceId}/command`, { type, args }),

  history: (deviceId: string) =>
    fetch(`${BASE}/api/v1/devices/${deviceId}/commands/history?limit=10`).then(
      json<{ items: CommandRecord[]; count: number }>,
    ),

  simSources: () =>
    fetch(`${BASE}/api/v1/sim`).then(json<{ items: SimSource[]; count: number }>),

  toggleSim: (
    subsystem: string,
    body: { enabled: boolean; seed?: number; backfill_hours?: number; rate_per_minute?: number },
  ) => post<Record<string, unknown>>(`/api/v1/sim/${subsystem}`, body),

  ask: (question: string) => post<AiAnswer>('/api/v1/ai/ask', { question }),

  summary: () => fetch(`${BASE}/api/v1/ai/daily-summary`).then(json<DailySummary>),
}
