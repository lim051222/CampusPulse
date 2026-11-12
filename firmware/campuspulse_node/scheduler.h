#pragma once
#include <Arduino.h>

namespace {

struct SchedTask {
  void (*fn)();
  uint32_t intervalMs;
  uint32_t lastMs;
};

template <size_t N>
void scheduler_run_all(SchedTask (&tasks)[N]) {
  const uint32_t now = millis();
  for (size_t i = 0; i < N; ++i) {
    if (now - tasks[i].lastMs < tasks[i].intervalMs) continue;
    tasks[i].lastMs = now;
    tasks[i].fn();
  }
}

}  // namespace

// Non-blocking cooperative scheduler: every task must return immediately.
// The DHT11 read is the only short (<=250ms) blocking call, run at >=2s spacing.
#define SCHEDULER_RUN(tasks) scheduler_run_all(tasks)
