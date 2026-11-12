export type Source = "real" | "simulated" | "user_submitted";

export interface BadgeSummary {
  badge_id: string;
  name: string;
  role: "student" | "lecturer" | "staff";
  avatar_seed: number;
  source: Source;
  room: string | null;
  room_rssi: number | null;
  room_confidence: "high" | "medium" | "low" | null;
  page: string | null;
  last_seen: string | null;
}

export interface LatestValue {
  value_num: number | null;
  value_text: string | null;
  ts: string;
  source: Source;
}

export interface SosEvent {
  id: string;
  badge_id: string;
  room: string | null;
  raised_at: string;
  status: "raised" | "acknowledged" | "resolved";
  acked_at: string | null;
  resolved_at: string | null;
  source: Source;
}

export interface BadgeDetail extends BadgeSummary {
  latest: Record<string, LatestValue>;
  sos: SosEvent[];
}

export interface RollCallResult {
  id: string;
  room: string;
  triggered_at: string;
  present: BadgeSummary[];
  absent: BadgeSummary[];
  present_count: number;
  absent_count: number;
  source: Source;
  note: string;
}

export interface RollCallSummary {
  id: string;
  room: string;
  triggered_at: string;
  present_count: number;
  absent_count: number;
  source: Source;
}

export interface RestroomSummary {
  restroom_id: string;
  enabled: boolean;
  ratings: number;
  average_stars: number | null;
  abandoned_sessions: boolean;
  source: Source;
  note: string;
}

export interface AcState {
  room: string;
  target_c: number | null;
  delegate_badge: string | null;
  created_at?: string;
  source: Source;
}

export interface AcAdvice {
  room: string;
  measured_c?: number;
  target_c: number | null;
  mode: string;
  message: string;
  badges_considered?: string[];
  requires_confirmation: boolean;
  reason?: string;
  sources: Source[];
}

export interface WifiAp {
  ap_id: string;
  name: string;
  room: string;
  online: boolean;
  clients: number;
  latency_ms: number;
  loss_pct: number;
  load_pct: number;
  minute: string;
  source: Source;
}

export interface WifiAlert {
  id: string;
  ap_id: string;
  kind: string;
  severity: string;
  started_at: string;
  resolved_at: string | null;
  source: Source;
}

export interface WifiPoint {
  ts: string;
  clients: number;
  latency_ms: number;
  loss_pct: number;
  load_pct: number;
  online: boolean;
}

export interface LightingRoom {
  room: string;
  verdict: "too_dark" | "too_bright" | "comfortable" | "mixed";
  median_index: number;
  spread: number;
  badge_count: number;
  badges: { device_id: string; value: number | null; ts: string; source: Source }[];
  recommendation: string | null;
  requires_confirmation: boolean;
  source: Source;
  unit: string;
}

export interface Device {
  device_id: string;
  name: string | null;
  room: string | null;
  mode: string | null;
  source: Source;
  status: "online" | "offline";
  last_seen: string;
  age_seconds: number;
  faults: string[];
  latest: Record<string, LatestValue>;
}
