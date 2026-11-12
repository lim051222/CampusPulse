export type Source = 'real' | 'simulated'
export type DeviceStatus = 'online' | 'offline'

export interface LatestValue {
  value_num: number | null
  value_text: string | null
  ts: string
  source: Source
}

export interface Device {
  device_id: string
  name: string | null
  room: string | null
  fw_version: string | null
  mode: string | null
  source: Source
  first_seen: string
  last_seen: string
  age_seconds: number
  status: DeviceStatus
  faults: string[]
  latest: Record<string, LatestValue>
}

export interface Reading {
  ts: string
  device_id: string
  metric: string
  value_num: number | null
  value_text: string | null
  source: Source
}

export interface SuggestionBasis {
  from: string | null
  to: string | null
  seconds: number
  occupancy: string
  light_rel_pct_above: number
}

export interface Suggestion {
  device_id: string
  kind: string
  text: string
  requires_human_confirmation: boolean
  basis: SuggestionBasis
  sources: Source[]
}

export interface InsightDevice {
  device_id: string
  data_points: number
  first_sample: string
  last_sample: string
  sources: Source[]
  alerts: number
  unoccupied_bright_seconds: number
}

export interface Insights {
  window: { from: string; to: string; hours: number }
  devices: InsightDevice[]
  suggestions: Suggestion[]
  reason?: string
}

export type CommandStatus = 'pending' | 'acked' | 'failed' | 'superseded'

export interface CommandRecord {
  id: string
  device_id: string
  type: string
  args: Record<string, unknown>
  status: CommandStatus
  created_at: string
  dispatched_at: string | null
  acked_at: string | null
  error: string | null
}

export interface SimSource {
  subsystem: string
  enabled: boolean
  seed: number
  rate_per_minute: number
  last_generated_at: string | null
  requires_authorisation: string
}

export interface AiCitation {
  device_id: string
  metrics: string[]
  from: string | null
  to: string | null
  sources: Source[]
}

export interface AiAnswer {
  answer: string
  mode: 'model' | 'rule_based'
  citations: AiCitation[]
  notes: string | null
}

export interface DailySummary {
  as_of: string
  windows_hours: number
  alerts: number
  unoccupied_bright_seconds: number
  devices_online: number
  devices_offline: number
  simulated_device_share: number
  sources: Record<string, number>
  insufficient_data: boolean
  notes: string
}

export interface Health {
  status: string
  version: string
  ai_enabled: boolean
  cors_origins: string[]
}
