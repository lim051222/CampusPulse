#pragma once
#include <Arduino.h>
#include "config.h"
#include "state.h"

struct Command {
  String id;
  String type;   // set_mode | mute_alarm | force_relay_off | set_sampling_interval
  String args;   // JSON object body, may be empty
};

void net_init();
void net_loop();                       // call every NET_TASK_MS

bool net_wifi_up();
bool net_backend_up();
bool net_time_synced();

void net_enqueue(const String& payload);
void net_enqueue_priority(const String& payload);   // SOS: flushed before telemetry
void net_enqueue_post(const String& path, const String& body);  // one-shot JSON POST
size_t   net_pending();
uint32_t net_dropped();

bool net_pop_command(Command& out);    // consume a command returned by the backend
void net_ack(const String& commandId, const char* status, const char* error = nullptr);

void net_print_diagnostics();          // serial dump for 5.6 troubleshooting
