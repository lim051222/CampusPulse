/*
 * ir_probe.ino  —  冷氣紅外線探測 / 重播工具（Day 1 先把這件事做完）
 *
 * 目的
 *   1) 把冷氣遙控（或 Xiaomi 手機的萬能遙控）按鍵的「協定 + 原始時序」印出來
 *   2) 直接生成可以貼進程式的 rawData[] 與 send 範例
 *   3) 需要時用原始時序重播同一顆鍵（不依賴解碼成功）
 *
 * 為什麼用 IRremoteESP8266 而不是 IRremote：
 *   冷氣是「有狀態」的（每次按鍵送出整串狀態），IRremoteESP8266 內建 Gree/Midea/
 *   Coolix/Chigo/Hisense/TCL/Daikin… 的 A/C 編碼器，能直接指定溫度/模式/風速。
 *
 * 接線
 *   VS1838B OUT  -> GPIO27   (VCC 3.3V, GND)   ← 接收
 *   IR LED 940nm -> GPIO4 -> NPN(2N2222/BC337) -> LED -> 22Ω -> 5V
 *   （LED 的腳要對到冷氣；NPN: Base=GPIO4 串 1k，Collector=LED 陰極，Emitter=GND）
 *
 * Library: "IRremoteESP8266" by crankyoldgit  v2.8.x（不是 IRremote！）
 *
 * 用法
 *   1. 燒錄，開 Serial Monitor @115200
 *   2. 手機 IR / 遙控器對準接收器，按「開機」「24°C」「關機」各一次
 *   3. 換行會出現：
 *        Protocol  : GREE   (或 UNKNOWN)
 *        uint16_t rawData[199] = {9000, 4500, ...};   ← 可直接貼
 *        IrSender.sendGree(...)                       ← 認得協定時會給
 *   4. 認得協定 -> 用對應的 sendXxx()（可設任意溫度，最好）。
 *      認不得   -> 把 rawData[] 貼到下面 gRawCode，設 REPLAY_RAW 1，用重播。
 */

#include <Arduino.h>
#include <IRremoteESP8266.h>
#include <IRrecv.h>
#include <IRsend.h>
#include <IRutils.h>

// ---------------------------------------------------------------- 設定
const uint16_t kRecvPin = 27;    // VS1838B OUT
const uint16_t kIrLedPin = 4;    // IR LED
const uint16_t kCaptureBufferSize = 1024;  // 冷氣訊框很長，不要調小
const uint8_t  kTimeout = 50;    // ms；冷氣用 50 比預設 15 穩

// 重播：認不得協定時才打開
#define REPLAY_RAW 0

// 把 resultToSourceCode() 印出來的 rawData[] 貼在這裡（REPLAY_RAW 1 時有效）
#if REPLAY_RAW
const uint16_t gRawCode[] = {
    // 例：9000, 4500, 560, 1690, ... , 560
};
const uint16_t kRawLen = sizeof(gRawCode) / sizeof(gRawCode[0]);
#endif

IRrecv irrecv(kRecvPin, kCaptureBufferSize, kTimeout, true);
IRsend irsend(kIrLedPin);
decode_results results;

// ---------------------------------------------------------------- setup
void setup() {
  Serial.begin(115200);
  delay(300);
  irsend.begin();
  irrecv.enableIRIn();

  Serial.println();
  Serial.println(F("=== IR PROBE (IRremoteESP8266) ==="));
  Serial.printf("recv=GPIO%u  send=GPIO%u  buf=%u  timeout=%ums\n",
                kRecvPin, kIrLedPin, kCaptureBufferSize, kTimeout);
#if REPLAY_RAW
  Serial.printf("REPLAY_RAW=1  len=%u  -> every 8s\n", kRawLen);
#endif
  Serial.println(F("Point the remote / phone at the receiver and press a key."));
  Serial.println();
}

// ---------------------------------------------------------------- loop
void loop() {
#if REPLAY_RAW
  Serial.printf("sendRaw(%u timings)...\n", kRawLen);
  irsend.sendRaw(gRawCode, kRawLen, 38);  // 38kHz
  delay(8000);
  return;
#endif

  if (!irrecv.decode(&results)) return;

  Serial.println(F("--------------------------------------------------"));
  Serial.print(resultToHumanReadableBasic(&results));  // 協定 / bits / hex
  Serial.println();
  Serial.print(resultToSourceCode(&results));          // rawData[] + send 範例
  Serial.printf("rawlen=%u  bits=%u  value=0x%llX\n",
                results.rawlen, results.bits,
                (unsigned long long)results.value);
  Serial.println();

  irrecv.resume();
}
