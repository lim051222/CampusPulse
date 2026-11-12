#include "net.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#include "pages.h"

namespace {

struct Buffered {
  char*    data    = nullptr;   // malloc'ed copy; freed the moment it is uploaded
  uint32_t dropped = 0;
};

Buffered s_buf[BUFFER_CAPACITY];
uint8_t  s_head      = 0;
uint8_t  s_tail      = 0;
uint32_t s_dropped   = 0;

// SOS events must not be lost behind a large telemetry backlog.
constexpr uint8_t PRIORITY_CAPACITY = 8;
Buffered s_priBuf[PRIORITY_CAPACITY];
uint8_t  s_priHead = 0;
uint8_t  s_priTail = 0;

// One-shot JSON posts (restroom feedback, ...). Kept small: they are user actions.
constexpr uint8_t POST_CAPACITY = 4;
struct PostItem {
  char* path = nullptr;
  char* body = nullptr;
};
PostItem s_postBuf[POST_CAPACITY];
uint8_t  s_postHead = 0;
uint8_t  s_postTail = 0;

constexpr uint8_t CMD_QUEUE_LEN = 8;
Command  s_cmdQueue[CMD_QUEUE_LEN];
uint8_t  s_cmdHead = 0;
uint8_t  s_cmdTail = 0;

constexpr uint8_t ACK_QUEUE_LEN = 8;
struct AckItem { String id; String status; String error; };
AckItem  s_ackQueue[ACK_QUEUE_LEN];
uint8_t  s_ackHead = 0;
uint8_t  s_ackTail = 0;

uint32_t s_nextWifiAttempt = 0;
uint32_t s_nextUploadAt    = 0;
uint32_t s_backoffMs       = 1000;
uint32_t s_lastOkMs        = 0;

bool buffer_empty() { return s_head == s_tail; }
uint8_t buffer_count() {
  return static_cast<uint8_t>((s_head + BUFFER_CAPACITY - s_tail) % BUFFER_CAPACITY);
}

void release_slot(Buffered& slot) {
  if (slot.data != nullptr) {
    free(slot.data);
    slot.data = nullptr;
  }
  slot.dropped = 0;
}

void push_command(const String& id, const String& type, const String& args) {
  const uint8_t next = static_cast<uint8_t>((s_cmdHead + 1) % CMD_QUEUE_LEN);
  if (next == s_cmdTail) return;  // drop oldest behaviour is not needed; newest wins
  s_cmdQueue[s_cmdHead] = {id, type, args};
  s_cmdHead = next;
}

void push_ack(const String& id, const char* status, const char* error) {
  const uint8_t next = static_cast<uint8_t>((s_ackHead + 1) % ACK_QUEUE_LEN);
  if (next == s_ackTail) return;
  s_ackQueue[s_ackHead] = {id, String(status), error ? String(error) : String()};
  s_ackHead = next;
}

void handle_ingest_response(const String& body) {
  StaticJsonDocument<2048> doc;
  if (deserializeJson(doc, body) != DeserializationError::Ok) return;

  JsonArray cmds = doc["commands"].as<JsonArray>();
  for (JsonObject c : cmds) {
    const String id   = c["id"].as<String>();
    const String type = c["type"].as<String>();
    String args;
    if (c.containsKey("args")) {
      serializeJson(c["args"], args);
    }
    if (id.length() && type.length()) {
      push_command(id, type, args);
    }
  }

  // The backend tells us whether the live SOS has been acknowledged.
  const char* sos = doc["sos"]["status"] | "";
  if (strcmp(sos, "acknowledged") == 0 || strcmp(sos, "resolved") == 0) {
    pages_on_sos_acknowledged();
  }
}

void flush_acks() {
  // One ACK per tick: a burst of blocking POSTs can starve the loop task and trip
  // the task watchdog, which in turn can land in the middle of a flash write.
  if (s_ackTail == s_ackHead) return;
  if (WiFi.status() != WL_CONNECTED) return;

  AckItem& a = s_ackQueue[s_ackTail];
  String url = String(API_BASE_URL) + "/api/v1/devices/" + DEVICE_ID + "/commands/" + a.id + "/ack";

  String body = "{\"status\":\"" + a.status + "\"";
  if (a.error.length()) body += ",\"error\":\"" + a.error + "\"";
  body += "}";

  HTTPClient http;
  http.setTimeout(2000);
  if (!http.begin(url)) return;
  http.addHeader("Content-Type", "application/json");
  const int code = http.POST(body);
  http.end();
  if (code < 200 || code >= 300) return;

  s_ackTail = static_cast<uint8_t>((s_ackTail + 1) % ACK_QUEUE_LEN);
  delay(1);   // let the idle task run so the watchdog is fed
}

bool send_slot(Buffered& item) {
  if (item.data == nullptr) return true;

  const String url = String(API_BASE_URL) + "/api/v1/ingest";

  // Only patch the body when records were actually dropped; otherwise send it as-is.
  String patched;
  const char* bodyPtr = item.data;
  if (item.dropped > 0) {
    patched = String(item.data);
    patched.replace("\"dropped_count\":0",
                    String("\"dropped_count\":") + String(static_cast<unsigned long>(item.dropped)));
    bodyPtr = patched.c_str();
  }

  HTTPClient http;
  http.setTimeout(2000);
  if (!http.begin(url)) {
    g_rt.backendUp = false;
    return false;
  }
  http.addHeader("Content-Type", "application/json");

  const int code = http.POST(reinterpret_cast<uint8_t*>(const_cast<char*>(bodyPtr)), strlen(bodyPtr));
  String body;
  if (code >= 200 && code < 300) {
    body = http.getString();
  }
  http.end();
  delay(1);   // feed the idle task between network operations

  if (code < 200 || code >= 300) {
    g_rt.backendUp = false;
    Serial.printf("[net] ingest failed http=%d pending=%u\n", code, buffer_count());
    return false;
  }

  g_rt.backendUp = true;
  s_lastOkMs     = millis();
  handle_ingest_response(body);
  release_slot(item);
  return true;
}

// Priority records (SOS) go out before ordinary telemetry.
bool send_post(PostItem& item) {
  const String url = String(API_BASE_URL) + String(item.path);

  HTTPClient http;
  http.setTimeout(3000);
  if (!http.begin(url)) return false;
  http.addHeader("Content-Type", "application/json");
  const int code = http.POST(reinterpret_cast<uint8_t*>(item.body), strlen(item.body));
  http.end();
  delay(1);

  Serial.printf("[net] POST %s -> %d\n", item.path, code);
  return code >= 200 && code < 300;
}

bool upload_one() {
  if (s_postTail != s_postHead) {
    PostItem& post = s_postBuf[s_postTail];
    if (!send_post(post)) return false;
    free(post.path);
    free(post.body);
    post.path = post.body = nullptr;
    s_postTail = static_cast<uint8_t>((s_postTail + 1) % POST_CAPACITY);
    return true;
  }

  if (s_priTail != s_priHead) {
    Buffered& pri = s_priBuf[s_priTail];
    if (!send_slot(pri)) return false;
    s_priTail = static_cast<uint8_t>((s_priTail + 1) % PRIORITY_CAPACITY);
    return true;
  }

  if (buffer_empty()) return true;

  Buffered& item = s_buf[s_tail];
  if (!send_slot(item)) return false;
  s_tail = static_cast<uint8_t>((s_tail + 1) % BUFFER_CAPACITY);
  return true;
}

}  // namespace

void net_init() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  for (uint8_t i = 0; i < BUFFER_CAPACITY; ++i) {
    release_slot(s_buf[i]);
  }
  for (uint8_t i = 0; i < PRIORITY_CAPACITY; ++i) {
    release_slot(s_priBuf[i]);
  }
  s_head = s_tail = 0;
  s_priHead = s_priTail = 0;
  s_dropped = 0;
  s_backoffMs = 1000;
  Serial.printf("[net] connecting to %s\n", WIFI_SSID);
}

bool net_wifi_up()      { return WiFi.status() == WL_CONNECTED; }
bool net_backend_up()   { return g_rt.backendUp; }
bool net_time_synced()  { return time(nullptr) >= static_cast<time_t>(NTP_MIN_VALID_EPOCH); }

void net_enqueue(const String& payload) {
  const uint8_t next = static_cast<uint8_t>((s_head + 1) % BUFFER_CAPACITY);
  if (next == s_tail) {
    // Buffer full: drop the OLDEST record and remember how many we lost.
    release_slot(s_buf[s_tail]);
    s_tail = static_cast<uint8_t>((s_tail + 1) % BUFFER_CAPACITY);
    ++s_dropped;
    fault_raise(FAULT_BUFFER_OVERFLOW);
  }

  const size_t len = payload.length();
  char* copy = static_cast<char*>(malloc(len + 1));
  if (copy == nullptr) {
    // Out of memory: count it as dropped rather than corrupting the ring.
    ++s_dropped;
    fault_raise(FAULT_BUFFER_OVERFLOW);
    return;
  }
  memcpy(copy, payload.c_str(), len + 1);

  s_buf[s_head].data    = copy;
  s_buf[s_head].dropped = s_dropped;
  s_head = next;
}

size_t net_pending() {
  const uint8_t telemetry = buffer_count();
  const uint8_t priority = static_cast<uint8_t>((s_priHead + PRIORITY_CAPACITY - s_priTail) % PRIORITY_CAPACITY);
  const uint8_t posts    = static_cast<uint8_t>((s_postHead + POST_CAPACITY - s_postTail) % POST_CAPACITY);
  return static_cast<size_t>(telemetry) + priority + posts;
}

uint32_t net_dropped() {
  const uint32_t v = s_dropped;
  return v;
}

bool net_pop_command(Command& out) {
  if (s_cmdTail == s_cmdHead) return false;
  out = s_cmdQueue[s_cmdTail];
  s_cmdTail = static_cast<uint8_t>((s_cmdTail + 1) % CMD_QUEUE_LEN);
  return true;
}

void net_ack(const String& commandId, const char* status, const char* error) {
  push_ack(commandId, status, error);
}

void net_enqueue_priority(const String& payload) {
  const uint8_t next = static_cast<uint8_t>((s_priHead + 1) % PRIORITY_CAPACITY);
  if (next == s_priTail) {
    release_slot(s_priBuf[s_priTail]);
    s_priTail = static_cast<uint8_t>((s_priTail + 1) % PRIORITY_CAPACITY);
  }

  const size_t len = payload.length();
  char* copy = static_cast<char*>(malloc(len + 1));
  if (copy == nullptr) return;
  memcpy(copy, payload.c_str(), len + 1);

  s_priBuf[s_priHead].data    = copy;
  s_priBuf[s_priHead].dropped = 0;
  s_priHead = next;
}

void net_enqueue_post(const String& path, const String& body) {
  const uint8_t next = static_cast<uint8_t>((s_postHead + 1) % POST_CAPACITY);
  if (next == s_postTail) {
    free(s_postBuf[s_postTail].path);
    free(s_postBuf[s_postTail].body);
    s_postTail = static_cast<uint8_t>((s_postTail + 1) % POST_CAPACITY);
  }

  s_postBuf[s_postHead].path = static_cast<char*>(malloc(path.length() + 1));
  s_postBuf[s_postHead].body = static_cast<char*>(malloc(body.length() + 1));
  if (s_postBuf[s_postHead].path == nullptr || s_postBuf[s_postHead].body == nullptr) {
    free(s_postBuf[s_postHead].path);
    free(s_postBuf[s_postHead].body);
    s_postBuf[s_postHead].path = s_postBuf[s_postHead].body = nullptr;
    return;
  }
  memcpy(s_postBuf[s_postHead].path, path.c_str(), path.length() + 1);
  memcpy(s_postBuf[s_postHead].body, body.c_str(), body.length() + 1);
  s_postHead = next;
}

void net_loop() {
  const uint32_t now = millis();

  // ---- Wi-Fi: non-blocking reconnect ----
  if (WiFi.status() != WL_CONNECTED) {
    g_rt.wifiUp = false;
    g_rt.backendUp = false;
    fault_raise(FAULT_WIFI);
    if (static_cast<int32_t>(now - s_nextWifiAttempt) >= 0) {
      s_nextWifiAttempt = now + 5000;
      Serial.println("[net] wifi reconnect");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    return;
  }

  g_rt.wifiUp = true;
  fault_clear(FAULT_WIFI);

  if (net_time_synced()) {
    fault_clear(FAULT_NTP);
  } else {
    fault_raise(FAULT_NTP);
  }

  flush_acks();

  if (static_cast<int32_t>(now - s_nextUploadAt) < 0) return;
  if (buffer_empty()) {
    s_backoffMs = 1000;
    s_nextUploadAt = now;
    return;
  }

  // Drain one record per tick: several blocking POSTs in a single loop() pass can
  // exceed the task-watchdog budget on a slow network.
  if (upload_one()) {
    s_backoffMs = 1000;
    s_nextUploadAt = now;
  } else {
    s_nextUploadAt = now + s_backoffMs;
    s_backoffMs = (s_backoffMs * 2 > 60000) ? 60000 : s_backoffMs * 2;
  }
}

void net_print_diagnostics() {
  Serial.printf("[diag] wifi=%d rssi=%d backend=%d pending=%u dropped=%u heap=%u\n",
                static_cast<int>(WiFi.status()), WiFi.RSSI(),
                g_rt.backendUp ? 1 : 0,
                static_cast<unsigned>(buffer_count()),
                static_cast<unsigned>(s_dropped),
                static_cast<unsigned>(ESP.getFreeHeap()));
}
