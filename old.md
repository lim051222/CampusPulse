# Chill — 房間會呼吸，學生有投票權

APU Cloud Innovation Hackathon 2026 · Track: **Smart Campus & Student Experience**
Prototype 截止：**13 Nov 2026 12:00** ｜ Top 5 pitching：**17 Nov**（只有這裡才強制用 Gemini Enterprise）

---

## 1. 一句話（deck 用）

> **Every room at APU is blind — it doesn't know if anyone is inside, how they feel, or how stale the air is. We give rooms a nervous system and students a voice, and we measure the comfort and kWh it saves.**

中文：課室不知道有沒有人、冷不冷、空氣悶不悶。我們讓房間會感測、會行動，讓學生有投票權，並**量出**省了多少電、換來多少舒適。

---

## 2. 問題（用學生的話講，不是用 BMS 的話講）

| 現象 | 代價 |
|---|---|
| 空課室冷氣照吹，整棟樓定時定溫 | 電費、碳排 |
| 有人時常常過冷（22°C 固定），學生帶外套上課 | 舒適、專注力 |
| 5-6 人關門討論 20 分鐘，CO2 破 1000ppm | 昏、頭痛、開會效率 |
| 自習時間到處找空房 / 討論室被佔位 | 時間 |

**同一個根因**：房間不知道自己現在的狀態（有人嗎 / 幾個人 / 幾度 / 空氣多悶），所以只能照課表盲吹。

---

## 3. 系統（三段 + 兩條旁線）

```
[工牌 ESP32]  被動掃 AP(BSSID+RSSI) + WiFi.BSSID() + 3 鍵投票
       │ burst：連上 WiFi → HTTPS POST → 斷線（不是一直掛著）
       ▼
[Server: Cloud Run]  指紋比對 → 房間 → Firestore(即時) + BigQuery(歷史)
       │              ▲ setpoint / 投票折衷 / 找空房
       ▼
[房間節點 ESP32]  SCD41(CO2+T+RH) → 本地 fallback 規則 → IR LED → 冷氣
                  ▲ NVS 環形緩衝（斷網照跑、復網補傳）
                  └ 旁線：回報自己的 WiFi RSSI / latency / 丟包
       ▼
[Web dashboard / 學生端]   房間卡、投票、找空房
       ▼（17 Nov）
[Gemini Enterprise Agent]  Ops / Student / Report 三個 agent
```

**為什麼不用 Pi**：伺服器放雲端就好。但**安全迴圈要放在 ESP32 上**——致動器自己知道「沒人 → 回 26°C」，這樣斷網、斷雲端、筆電睡著都不影響。這比放 Pi 更對，而且 demo 更有說服力。

---

## 4. Scope

### IN（一定要交）
- 1 間房節點：CO2 + 溫度 + 濕度 + 紅外線控制實體冷氣
- 3 個工牌：AP 掃描定位 + 太冷/剛好/太熱 三鍵投票
- 雲端：即時狀態 + 歷史 + 控制迴圈（空房 setback / 有人回復 / 投票折衷）
- 學生端：一頁（現在哪間房涼又空 + 我這間太冷）
- 斷網韌性：拔線照跑，復網補資料
- 三個量測數字（見 §7）

### OUT（明講不做，評審問就答這個）
- 燈光 / 窗簾（教室不是 smart switch，不承諾）
- 廁所清潔、人臉/指紋、代打卡偵測
- 讀 AP controller 的關聯表（這條路要 IT 權限；被動掃描不需要）
- 全校部署（只做 1-2 間，寫成「每房一個節點的擴充成本」）

---

## 5. 硬體（全 ESP32，無 Pi）

| 件 | 數量 | 用途 | 備註 |
|---|---|---|---|
| ESP32 devkit | 1 | 房間節點 | 你已有 |
| ESP32 / ESP32-C3 SuperMini | 3 | 工牌 | 要連 WiFi + 掃描；C3 也行（2.4GHz） |
| SCD41 | 1 | **CO2 + 溫度 + 濕度，一顆搞定** | I2C；比溫濕度+CO2 兩顆少一個失效點 |
| VS1838B 紅外線接收 | 1 | **錄冷氣碼**（Day 1 關鍵） | 3.3V 可跑 |
| 940nm IR LED + NPN(2N2222/BC337) + 22Ω | 2 組 | 發射 | LED 要對得到冷氣，貼牆/吊高 |
| 按鍵 | 3 | 投票 | 內建 pull-up |
| 行動電源 / 5V | 2 | demo 供電 | 別用課室插座拉線 |

接腳（建議）：IR 接收 `GPIO27`、IR 發射 `GPIO4`、按鍵 `GPIO32/33/25`、SCD41 `SDA21/SCL22`。

---

## 6. 定位：被動掃描（零權限）+ 四模態對照

**先修正一句話**：工牌被動掃描 AP **不需要任何權限** — 你自己就聽得到 RSSI。
之前說「需要 IT」指的是另一條路（讀 AP controller 的關聯表 / SNMP），不是你這條。

| 項目 | 評估 |
|---|---|
| 需要 IT 權限 | **零** — 工牌自己掃，server 只收結果 |
| 你為什麼會對 | 密集部署（每房一顆 AP）+ 指紋比對，是房間級定位**最好的情況**，不是最壞 |
| 真正的成本 | 不是權限，是**普查**（~100 間房的 RSSI 指紋庫） |
| 解法 | 工牌自己就是探針 → 師生走動時 crowdsource 建圖、持續更新（亮點：免費且會自我更新的 site survey） |
| ESP32 硬限制 | 一次只聽一個 channel；13 通道被動掃一輪約 1.5–2.5s → 10–20 秒一個 snapshot（在場判定夠用） |
| 耗電 | radio 開著掃很貴 → 必須 burst / duty-cycle（掃 → 關 radio → 睡 → 每 60s 連一次上報） |
| 物理限制 | 身體遮擋與轉身造成 ±5–8dB 抖動；ESP32 只有 2.4GHz，聽不到 5GHz 的 BSSID |

### 免費的第二個訊號：不用掃描也能定位

工牌一連上 WiFi，`WiFi.BSSID()` 就是「你現在掛在哪顆 AP」，`WiFi.RSSI()` 是那條鏈路的強度。
**零掃描成本**的一個定位點 —— 剛好給你一個天然的 A/B 實驗：

| 方法 | 成本 | 精度（要自己量） |
|---|---|---|
| A. 只關聯（`WiFi.BSSID()` + `RSSI()`） | 極低（幾乎不耗電） | 粗，房間 ±1–2 |
| B. 全通道掃描 + 指紋 | 高（耗電） | 房間級 |
| C. 房間節點 BLE 近場 | 中（要節點） | 房間級，走廊會誤判 |
| D. B + C + CO2 融合 | 高 | 最好 |

**把 A → D 的差距量出來，就是你這份 project 的貢獻**，而不是一句「我們很準」。

### 校園 WiFi：已確認只需密碼（好消息 + 兩個坑）

1. **工牌不要「同時連線又掃描」** — 掃描會讓 STA 暫時離開當前 channel，頻繁掃會掉線重連。正確做法是 burst：
   `掃 2 秒 → 關 radio → 睡 50 秒 → 連 2–4 秒 POST → 斷`
2. **規模**：300 個工牌 = 300 個 DHCP lease + 300 個關聯。這是 AP 的負擔，也是 deck 裡 Network 那段最好的論點 —— **「所以我們大部分時間是被動監聽，不是製造 association」**。

（節點側旁線仍成立：每顆節點回報自己的 `WiFi.RSSI()` / latency / 丟包 →「這間房連線不穩」。）

---

## 7. 要量出來的數字（KPI）

| # | 指標 | 基線 / 對照 | 量測 | 產出 |
|---|---|---|---|---|
| 1 | 房間級定位 | 人工站點、課表 | A 關聯-only / B 掃描指紋 / C BLE / D 融合 | 房間混淆矩陣、precision / recall、各模態耗電 |
| 2 | 在場判定 | CO2 上升曲線 + 人工點名 | 同上 | 誤判率（**空房誤判有人最貴**） |
| 3 | 節能 + 舒適 | 2 天照原本課表吹 | 2 天需求控制 | 冷氣運轉時間降 %、舒適帶分鐘 %、CO2 峰值降 % |

規則：**只報量到的，不報形容詞。** 「我們量到 83%，錯的集中在走廊側」遠比「準確率很高」有說服力。

---

## 8. 五天行程

| 日 | 目標 | 完成定義 |
|---|---|---|
| **Sun 8（今晚）** | 註冊截止 23:59；鎖 scope；確認教室 + 冷氣 | 隊已建好、能進 workspace |
| Mon 9 | **IR 碼打通**（最大風險先做）+ SCD41 讀值上雲 | 手機/遙控按一下，ESP32 能重播同一顆鍵 |
| Tue 10 | 節點進駐真實房間，**只記錄不控制**（基線） | BigQuery 有連續資料 |
| Wed 11 | 控制迴圈 + 投票折衷 + 斷網 buffer + 網頁 | 空房 60s 進 setback、有人回復 |
| Thu 12 | 跑數字、出圖、deck、**90 秒 demo 影片**、彩排 | 影片可在無網路下播放 |
| Fri 13 | **11:00 前**由 leader 提交（一交就鎖） | repo(HTTPS) + PDF ≤10MB 已上傳 |

---

## 9. 風險

| 風險 | 機率 | 對策 |
|---|---|---|
| 冷氣 IR 碼對不上（Dongxinbao 是小牌子，lib 沒列） | **高** | Day 1 用「錄原始時序 + 重播」，不依賴協定解碼；見 `firmware/ir_probe` |
| 定頻冷氣關機再開有壓縮機保護延遲（~3 分鐘） | 中 | demo 用「調溫度」代替「關機」 |
| 掃描耗電（電池撐不到 demo） | **高** | burst 模式 + demo 時插行動電源，誠實標示 |
| 同時連線又掃描導致掉線 | 中 | 分時：掃描期間不傳輸，傳輸期間不掃描 |
| 指紋庫不完整 → 誤判到隔壁房 | **高** | 每間 demo 房走 5 個點建圖；報混淆矩陣，不報單一準確率 |
| 課室 WiFi 認證 | **低（已確認：只需密碼、無二次驗證）** | 仍要確認 ESP32 拿得到 IP（DHCP 池夠、無 captive portal） |
| ESP32 TLS 連雲端卡住 | 中 | 第一天就退回 HTTP POST 純文字（prototype 可以講明白） |
| 冷氣太遠 / 沒視線 | 中 | IR LED 貼牆、加一顆；或改用「IR 接收器 + 假面板」並標 simulated |
| 筆電睡著斷資料 | 高 | 節點自己緩衝，雲端才是來源 |
| OneDrive 同步衝突 | 低 | 把 repo 放 `C:\dev\`，只把文件放 Hackathon 資料夾 |

---

## 10. 隱私（PDPA，30 秒 slide）

- 工牌只上報**輪換假名**（每 60s 換），server 不以 MAC / 學號識別
- 原始 RSSI 向量保留 **10 分鐘**後降為「在/不在 + 房間」，之後只留聚合數字
- 在場紀錄保留 **10 分鐘**，之後只留聚合數字
- 投票匿名，只有 3 個計數
- 講法：*“We're not building a tracking system. We're building a comfort system that forgets.”*

---

## 11. 13 號提交 ／ 17 號 Gemini

提交只需要：專題名 / 選定 track / ≥50 字 summary / **HTTPS repo** / PDF deck ≤10MB / demo link（選填）。**prototype 不需要 Gemini。**

17 號才要 Gemini Enterprise（它是 Google Cloud 的 agent 平台：Agent Studio / ADK / Agent Runtime / Agent Garden / 企業連接器 / Agent Gateway 治理）。**所以現在先把接口留好**：

```
POST /rooms/{id}/setpoint        ← agent 的動作
GET  /rooms/{id}/state           ← agent 的查詢
GET  /rooms?free=1&cool=1        ← 學生 agent 的查詢
BigQuery: room_telemetry, control_actions
```
到 15-17 號，agent 只是接上去，零重寫。三個 agent：Ops（「03-07 昨天下午為什麼悶」）、Student（「我現在去哪讀書」）、Report（每日省電報告 → Docs/Sheets）。

---

## 12. 90 秒 demo 分鏡（先寫好再拍）

| 秒 | 畫面 | 台詞重點 |
|---|---|---|
| 0-15 | 空課室，冷氣吹著，卡片顯示 0 人 / 22.4°C / 480ppm | 這間房現在在浪費電，而且它不知道 |
| 15-30 | 60 秒後冷氣進 26°C（IR 燈閃一下，有接收器證明） | 不是切電，是讓它自己停 |
| 30-50 | 3 個工牌進場 → 定位到「就是這間房」→ 回到 24°C；CO2 開始爬 | 房間知道有人了 |
| 50-65 | 5 人小房間 CO2 1200ppm → 通風提示；有人按「太冷」→ setpoint 折衷 | 學生有投票權，不是被固定溫度統治 |
| 65-80 | **拔掉網路線**：冷氣照樣反應，雲端顯示離線 | 網路斷了，房間仍然安全（NTT DATA 會看這段） |
| 80-90 | Gemini 問：「昨天 03-07 為什麼悶？」→ 引用真實數據回答 | 這就是 17 號的產品 |

---

## 13. 還沒決定

- [ ] 哪間課室/實驗室可以用（含冷氣品牌 Dongxinbao 的那台）
- [ ] 隊友有幾個人、各自負責什麼
- [ ] 定頻 or 變頻（影響 demo 能不能關機）
- [ ] 專題名稱（暫定 Chill）
