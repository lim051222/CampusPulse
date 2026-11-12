import type {
  AcAdvice,
  AcState,
  BadgeDetail,
  BadgeSummary,
  Device,
  LightingRoom,
  RestroomSummary,
  RollCallResult,
  RollCallSummary,
  SosEvent,
  WifiAlert,
  WifiAp,
  WifiPoint,
} from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

const get = <T>(path: string) => fetch(path, { cache: "no-store" }).then(json<T>);
const post = <T>(path: string, body?: unknown) =>
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(json<T>);

export const api = {
  health: () => get<{ status: string; version: string; ai_enabled: boolean }>("/healthz"),
  devices: () => get<{ items: Device[] }>("/api/v1/devices"),
  badges: () => get<{ items: BadgeSummary[]; source: string }>("/api/v1/badges"),
  badge: (id: string) => get<BadgeDetail>(`/api/v1/badges/${id}`),

  sosList: (status?: string) =>
    get<{ items: SosEvent[] }>(`/api/v1/sos${status ? `?status=${status}` : ""}`),
  ackSos: (id: string) => post<SosEvent>(`/api/v1/sos/${id}/ack`),
  resolveSos: (id: string) => post<SosEvent>(`/api/v1/sos/${id}/resolve`),

  rollcall: (room: string) =>
    post<RollCallResult>(`/api/v1/attendance/rollcall?room=${encodeURIComponent(room)}`),
  rollcalls: () => get<{ items: RollCallSummary[] }>("/api/v1/attendance/rollcalls"),

  restroom: (restroomId: string) =>
    get<RestroomSummary>(`/api/v1/restroom/summary?restroom_id=${encodeURIComponent(restroomId)}`),
  setRestroomEnabled: (restroomId: string, enabled: boolean) =>
    post<{ restroom_id: string; enabled: boolean }>("/api/v1/restroom/settings", {
      restroom_id: restroomId,
      enabled,
    }),
  submitRestroom: (restroomId: string, stars: number, abandoned = false) =>
    post<{ stars: number }>("/api/v1/restroom/feedback", {
      restroom_id: restroomId,
      stars,
      abandoned,
    }),

  acState: (room: string) => get<AcState>(`/api/v1/ac/state?room=${encodeURIComponent(room)}`),
  acCommand: (room: string, delegate_badge: string, target_c: number) =>
    post<{ target_c: number; warning: string | null; note: string }>("/api/v1/ac/command", {
      room,
      delegate_badge,
      target_c,
    }),
  acAdvise: (room: string) => post<AcAdvice>("/api/v1/ac/advise", { room }),

  wifiAps: () => get<{ items: WifiAp[] }>("/api/v1/wifi/aps"),
  wifiAlerts: () => get<{ items: WifiAlert[] }>("/api/v1/wifi/alerts"),
  wifiSeries: (apId: string, hours: number) =>
    get<{ points: WifiPoint[] }>(`/api/v1/wifi/series?ap_id=${apId}&hours=${hours}`),

  lighting: () => get<{ rooms: LightingRoom[]; empty_reason: string | null }>("/api/v1/lighting/summary"),
};
