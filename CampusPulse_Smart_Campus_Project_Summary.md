# Smart Campus / Smart ID Badge 项目讨论总结

> 整理日期：2026-11-12\
> 项目暂定名称：**CampusPulse**\
> 项目方向：Smart Campus & Student Experience\
> 核心概念：以智能学生证（Smart Campus ID
> Badge）为入口，连接校园身份、教室环境、校园设施和 AI
> 管理平台，改善学生体验并协助校园管理人员提升运营效率。

------------------------------------------------------------------------

## 1. 项目愿景与定位

项目希望建立一个连接学生、校园设施和管理平台的 Smart Campus 系统。

**暂定英文定位：**

> An AI-powered Smart Campus Infrastructure & Identity Platform.

**核心价值：**

-   学生：智能身份识别、签到、校园信息和语音互动。
-   讲师：更方便的课堂体验和环境信息。
-   Facilities Management：掌握教室环境、能源使用和清洁需求。
-   IT / Network Administrators：监测校园 Wi-Fi 基础设施和网络状态。
-   管理层：通过数据和 AI 辅助识别设施问题及能源浪费。

项目不是单纯制作一张智能卡，而是以 Badge 和 IoT Sensor
为数据入口，配合后台平台及 AI 分析。

## 2. 讨论过的主要功能模块

### 2.1 Smart Classroom & Energy Management

目标：监测教室环境和占用情况，协助减少不必要的能源消耗。

讨论过的功能：

-   测量温度、湿度、光照、CO₂ 和粉尘等环境数据。
-   通过人体感应或其他占用检测方式，判断教室是否可能有人。
-   教室长时间无人时，向设施管理人员发出关闭空调或灯光的建议。
-   在符合设备兼容性及授权的情况下，通过红外线发送空调遥控指令。
-   将环境和设备状态显示在 Dashboard。
-   后续可分析哪些教室经常在无人时仍然使用空调，协助识别能源浪费。

**重要技术限制：**

-   HC-SR501 PIR
    主要检测移动，不等于准确人数，也不能可靠证明房间持续无人。
-   智能 Badge
    上的温度传感器会受到人体体温影响，不应直接代表室内温度；室内环境测量应使用固定位置的
    Room Sensor。
-   红外控制需要确认空调遥控协议、接收范围和视线条件。不同空调品牌/型号可能使用不同编码；部分空调需要发送完整状态数据。
-   若空调或灯具没有智能控制接口，Prototype
    可以先展示建议、告警或模拟控制；实际接入须获得设施管理部门批准。
-   不应直接在面包板上接入 240V 市电。

### 2.2 Wi-Fi Infrastructure Monitoring

目标：让校园 IT 管理人员掌握 AP 和无线网络健康状况。

可能监测的数据：

-   AP 在线/离线状态。
-   Client 数量和连接状态。
-   Latency、Packet Loss。
-   AP 负载和连接异常。
-   网络故障告警及趋势。

**依赖条件：**

-   需要取得校园 Wi-Fi Controller 或网络管理系统的授权 API、Telemetry
    或日志。
-   不能假设项目可以直接访问 APU 的网络设备。
-   可以先使用模拟数据或自建测试 AP 展示
    Dashboard，再在获得授权后接入真实数据。

### 2.3 Smart Attendance / Student Identity

目标：利用 NFC 或 Badge 身份识别协助签到。

讨论过的方向：

-   使用 NFC 卡或智能 Badge 识别学生身份。
-   将签到事件发送到后台系统。
-   可结合教室区域或课程时段辅助判断出席。

**限制与隐私：**

-   读到 Badge 不等于证明学生本人在场；卡片可能被转借。
-   Wi-Fi AP 关联或 RSSI 只能辅助估计区域，不应当作精确室内定位。
-   需要明确学生同意、数据用途、访问权限和保留期限。
-   指纹识别曾被提及，但不建议作为当前 Prototype 的必要功能。

### 2.4 Smart Toilet & Facility Cleaning

讨论过利用厕所占用情况和环境数据辅助安排清洁。

建议的安全设计：

-   使用匿名人数/进出计数或非身份化占用数据。
-   使用空气质量或气味相关指标作为清洁检查的辅助信号。
-   当数据达到阈值时，通知清洁人员进行人工检查。

**明确不建议：**
在厕所追踪具名学生、采集个人身份或使用摄像头识别使用者。传感器数据也不能单独证明厕所"脏"，应定位为清洁检查提示。

### 2.5 Smart Lighting

目标：教室无人时减少不必要的照明。

-   当前讨论的学校/校园普通开关未必具备智能控制能力。
-   Prototype 可先检测占用状态并发出关灯建议，或用低压 LED 模拟灯光。
-   真实灯具控制需要合规继电器/智能开关、电气安全设计及设施部门批准。

------------------------------------------------------------------------

## 3. Smart ID Badge 的硬件方向

曾讨论希望 Badge 具备：

-   银行卡大小的外形。
-   Wi-Fi 与 Bluetooth。
-   麦克风和扬声器。
-   NFC 身份识别。
-   语音通知、按键语音输入及 AI 对话。
-   理想目标为多日续航（曾提出约 2--3 天目标，尚未验证）。

### 建议的技术方向

-   **MCU：** ESP32-S3-WROOM-1-N8R8 可作为候选。
-   **Firmware：** ESP-IDF / FreeRTOS。
-   **Audio：** I²S microphone + I²S audio amplifier + miniature
    speaker。
-   **Connectivity：** Wi-Fi、Bluetooth LE、HTTPS / MQTT / WebSocket。
-   **AI：** 语音识别、LLM 和语音合成优先放在云端或服务器端，不在 Badge
    本身运行大型模型。
-   **NFC：** PN532 可用于实验；正式 Badge
    是否兼容校园现有读卡器，必须先确认卡片技术和门禁协议。

ESP32-S3 不是 Linux SBC，运行 ESP-IDF /
FreeRTOS。它适合低功耗嵌入式控制，但并不适合在 Badge 上直接运行完整
Linux 系统。

### 语音交互建议

Prototype 优先实现 **Push-to-Talk**：

1.  学生按下实体按钮。
2.  Badge 录制一段语音。
3.  音频通过 Wi-Fi 上传到后端。
4.  后端调用语音识别 / AI 服务。
5.  将回复转换成语音并传回 Badge。
6.  Badge 播放回复。

一开始不建议持续监听或全双工实时对话，因为会增加功耗、回声处理和隐私设计难度。应有实体静音方式、录音指示和清楚的用户告知。

### 电池与尺寸

-   曾讨论 3.7V、约 700mAh Li-Po 作为早期候选，但并未验证续航。
-   2--3 天续航取决于 Wi-Fi
    使用频率、录音时间、屏幕/LED、休眠策略及电源转换效率。
-   应先测量实际平均电流，再估算电池容量。
-   后续定制 PCB 需考虑天线净空、NFC
    天线、音频开孔、电池保护、充电、电源路径、散热和外壳结构。

建议开发顺序： 1. 使用开发板和外接模块验证功能。 2. 完成功能后再设计定制
PCB。 3. 最后优化银行卡大小外壳、功耗和量产设计。

------------------------------------------------------------------------

## 4. 目前已经拥有的 ESP32 器材

用户列出的现有器材：

  器材                                   数量
  ------------------------------------ ------
  ESP32 Development Board                   1
  0.96-inch OLED                            1
  830-hole Breadboard                       1
  Infrared Obstacle Avoidance Module        1
  Photoresistor Module                      1
  DHT11 Module                              1
  HC-SR501 PIR Sensor                       1
  10kΩ Potentiometer                        1
  Micro-USB Cable                           1
  1kΩ Resistors                            10
  10kΩ Resistors                           10
  220Ω Resistors                           10
  Passive Buzzer                            1
  Active Buzzer                             1
  5V 2-channel Relay Module                 1
  Switch Keycaps / Buttons                  6
  F-M Dupont Wires                         10
  F-F Dupont Wires                         10
  M-M Dupont Wires                         10
  Red LEDs                                  5
  Blue LEDs                                 5
  Green LEDs                                5
  RGB LED                                   1

### 现有器材可以先完成的实验

-   DHT11 温湿度显示到 OLED。
-   PIR 检测移动并触发 LED / Buzzer。
-   Photoresistor 测量光线变化。
-   Relay 做低压设备开关演示。
-   Potentiometer 模拟阈值或控制输入。
-   将传感器读数通过 ESP32 Wi-Fi 发送到网页 Dashboard。

**型号待确认：** 用户只说 ESP32 Development Board，尚未确认是
ESP32-WROOM-32、ESP32-S3 或
ESP32-C3。购买额外板子或音频模块前，应先确认具体型号。

------------------------------------------------------------------------

## 5. 已讨论的追加采购候选

以下是候选清单，不代表已经购买，也不代表已确认某一家店有货。

### 5.1 Smart Classroom 环境监测

  -----------------------------------------------------------------------------------
  元件                    用途                     建议
  ----------------------- ------------------------ ----------------------------------
  BME280                  温度、湿度、气压         可选；若选 SHT31
                                                   也可避免重复买温湿度传感器

  SHT31-D                 温湿度                   可作为比 DHT11
                                                   更好的环境传感器候选

  BH1750                  Lux 光照测量             推荐，较 Photoresistor
                                                   更适合量化光照

  SCD40 / SCD41           NDIR CO₂ 测量            若需要可信 CO₂ ppm，优先考虑

  GP2Y1014AU              光学粉尘传感器           可做粉尘变化
                                                   Demo；需校准，不能自动视为标准
                                                   PM2.5 仪器

  MQ-135                  多种气体响应             低成本趋势实验；不能直接当作准确
                                                   CO₂ ppm 传感器

  HX1838 / VS1838B IR     读取及发送红外遥控信号   推荐用于空调遥控实验
  Receiver + 940nm IR LED                          

  2N2222 NPN Transistor   驱动 IR LED              候选；需按 LED
                                                   电流设计电阻和驱动电路
  -----------------------------------------------------------------------------------

### 5.2 NFC Badge

  元件                  用途           建议
  --------------------- -------------- ------
  PN532 NFC Reader      NFC 读卡实验   候选
  NTAG213 / NFC Cards   测试卡片       候选

**兼容性提醒：** NFC
频率相同不代表卡片协议、加密或校园门禁系统兼容。先确认现有校园卡技术，不要承诺可复制或替代现有学生证。

### 5.3 Voice Badge

  --------------------------------------------------------------------------------------------
  元件                    用途                    建议
  ----------------------- ----------------------- --------------------------------------------
  ESP32-S3-WROOM-1-N8R8   音频/语音 MCU           候选，先确认现有 ESP32 型号
  Board                                           

  INMP441 I²S Microphone  录音                    候选

  MAX98357A I²S Amplifier 音频输出放大            候选

  8Ω Mini Speaker         语音播放                候选

  3.7V Li-Po Battery      电池供电                候选，容量需按功耗测试决定

  Battery Protection /    电池安全及充电          必须认真选型，不能只买电池就直接连接开发板
  Charger / Power Path                            
  --------------------------------------------------------------------------------------------

### 5.4 辅助器材

-   Multimeter：测量电压、电流和电阻。
-   额外 Push Buttons。
-   额外 Jumper Wires。
-   合适的 USB 5V 电源。
-   4.7kΩ 电阻：特定传感器（如 DS18B20）上拉用途，需按具体电路决定。
-   MOSFET：驱动低压 LED Strip
    等负载时使用，需选逻辑电平型号并正确设计。

------------------------------------------------------------------------

## 6. 红外模块：已澄清的重点

用户询问过现有的 **Infrared Obstacle Avoidance Module**
能否代替空调遥控用的 IR 模块。

结论：**不能直接代替。**

-   Obstacle Avoidance
    Module：发射红外光并检测反射，输出物体存在/不存在的逻辑状态。
-   IR Receiver（如 VS1838B /
    HX1838）：接收遥控器的调制红外信号，适合读取常见 38kHz 遥控器编码。
-   IR Transmitter：通常是 940nm IR LED，由 MCU
    按协议产生载波和脉冲时序。

用户考虑过的商品名称： -
`IR Infrared 940nm Transmitter / Receiver VS1838B 5mm LED` -
`HX1838 Infrared IR Receiver Sensor And LED Transmitter Module`

两者若确实同时包含 IR LED 发射器和 VS1838B/HX1838
接收器，均可作为实验候选。购买前需确认商品套装实际包含的元件和引脚形式。

------------------------------------------------------------------------

## 7. MQ-135 与 GP2Y1014AU 的定位

两者不是同一类传感器：

  传感器          检测对象                               不能误称为
  --------------- -------------------------------------- ---------------------------------------
  MQ-135          对多种气体有交叉响应，可用于趋势实验   精确 CO₂ ppm 仪器
  GP2Y1014AU      光学粉尘响应                           自动等同于经过校准的标准 PM2.5 监测仪
  SCD40 / SCD41   NDIR CO₂ 测量                          粉尘传感器

建议展示名称： - MQ-135：**Air Quality / Gas Trend Monitoring** -
GP2Y1014AU：**Optical Dust Trend Monitoring** - SCD40：**CO₂
Monitoring**

MQ-135 通常需要加热、预热和校准；其模拟输出需确认不超过 ESP32 ADC
输入范围。GP2Y1014AU 需要按时序驱动红外 LED
并读取模拟输出，具体电阻、电容和供电依模块版本而定。

------------------------------------------------------------------------

## 8. 软件与系统架构方向

建议将嵌入式设备、后端、数据库和 AI 服务分层：

``` text
[Smart Badge / ESP32 / Room Sensors]
                 |
          Wi-Fi / MQTT / HTTPS
                 |
        [Backend / API Service]
                 |
       [Database + Event Storage]
                 |
        [Campus Management UI]
                 |
       [AI / Gemini Integration]
```

可能的技术选择：

-   Firmware：ESP-IDF / FreeRTOS。
-   Device messaging：MQTT。
-   Backend：Python FastAPI 或 Node.js。
-   Database：PostgreSQL。
-   Dashboard：Web application。
-   AI：通过经确认的 Gemini / Gemini Enterprise
    能力进行问答、摘要和异常解释。

AI 可展示的示例问题：

-   "Which classrooms show signs of unnecessary energy usage?"
-   "Which rooms have elevated CO₂ readings?"
-   "Which access points have unusually high packet loss?"
-   "Summarise the campus environment alerts from today."

AI
的回答应基于系统实际收集的数据；没有接入真实数据时，应明确标记为模拟数据。

**Gemini Enterprise 注意：** Hackathon 对 Gemini Enterprise
工具或授权的具体要求，需要根据主办方正式说明和实际发放的 License/API
权限确认，不能假设一般 Gemini API Key 就等同于 Gemini Enterprise。

------------------------------------------------------------------------

## 9. Prototype 优先级建议

考虑 Hackathon
时间和硬件可行性，建议先做一个完整、稳定、可演示的核心流程，而不是同时实现所有模块。

### MVP（优先实现）

1.  ESP32 读取温湿度、光照和人体移动数据。
2.  OLED 显示传感器数据。
3.  ESP32 通过 Wi-Fi 把数据发送到 Backend。
4.  Dashboard 显示实时/历史数据。
5.  依据占用与环境数据生成空调/照明节能提示。
6.  使用 IR LED 在兼容空调上演示遥控；若来不及，使用模拟设备演示。

### 次要功能

-   CO₂ 或粉尘监测。
-   NFC 身份识别。
-   Wi-Fi 状态
    Dashboard（先用模拟数据，待取得网络授权后再接入真实数据）。

### 后续愿景

-   语音 AI Badge。
-   智能签到。
-   智能清洁辅助。
-   自动照明与空调联动。
-   跨楼宇的能源与设施预测分析。

------------------------------------------------------------------------

## 10. 风险、隐私与验证清单

-   [ ] 确认现有 ESP32 开发板的准确型号。
-   [ ] 确认校园 Wi-Fi Controller 是否提供获授权的数据接口。
-   [ ] 确认空调品牌、型号、红外协议和实际控制权限。
-   [ ] 确认现有学生卡的 NFC / RFID 技术和门禁兼容要求。
-   [ ] 用固定 Room Sensor 测量室内温度，不以佩戴式 Badge 温度代表室温。
-   [ ] 不将 PIR 移动检测当作准确人数或无人证明。
-   [ ] 不在厕所采集具名身份或进行个人追踪。
-   [ ] 给 Badge 的麦克风提供实体静音/录音提示，并避免未经同意持续录音。
-   [ ] 测试电池平均电流、休眠功耗、充电和保护电路。
-   [ ] 确保 ESP32 ADC 不会承受超过允许范围的电压。
-   [ ]
    任何真实空调、照明或市电接入都需符合电气安全要求并取得设施管理部门批准。
-   [ ] 对传感器测量结果进行校准或明确标示为趋势/实验数据。
-   [ ] Dashboard 和 AI 输出应区分真实数据与模拟数据。

------------------------------------------------------------------------

## 11. 目前讨论所得的结论

1.  项目方向为以 Smart ID Badge 为入口的 Smart Campus
    平台，而不只是一个传感器项目。
2.  最适合先完成的 Demo 是 Smart Classroom Environment & Energy
    Monitoring。
3.  用户已有的 ESP32 套件足够开始基础传感器、OLED、PIR、LED、Buzzer 和
    Wi-Fi 实验。
4.  现有 Obstacle Avoidance IR 模块不能代替空调遥控所需的 IR Receiver +
    IR Transmitter。
5.  HX1838 / VS1838B + 940nm IR LED 是可考虑的红外实验套件。
6.  BH1750 比普通 Photoresistor 更适合显示 Lux；SCD40/41
    才适合测量可信的 CO₂ ppm。
7.  MQ-135 可做气体响应趋势实验，不能当作精确 CO₂ 传感器。
8.  GP2Y1014AU 可做光学粉尘趋势实验，但需要正确驱动和校准。
9.  NFC、Voice AI、Wi-Fi Controller
    接入和自动控制应按时间、授权及硬件条件逐步实现。
10. 用户提供过 Shopee
    店铺：<https://shopee.com.my/jerrylee92?page=0&shopCollection=104745205>，希望尽量在同一家店采购；目前不能把尚未核实的商品视为该店已上架或有库存。

## 12. 下一步建议

1.  拍摄或确认现有 ESP32 开发板正反面型号。
2.  先完成 ESP32 + DHT11 + OLED + PIR + Photoresistor 的基础 Demo。
3.  确认 Shopee 商品详情后，优先采购 BH1750、合适的温湿度传感器及 HX1838
    红外套件。
4.  若预算允许，再加入 SCD40/41 或
    GP2Y1014AU，选择其中最符合展示目标的传感器。
5.  把传感器数据上传到 Backend，建立 Dashboard 和 AI 数据问答。
6.  在核心 Demo 稳定后，再扩展 NFC 和语音 Badge。

------------------------------------------------------------------------

*本文件是截至 2026-11-12
的讨论整理。采购候选、技术方案和功能愿景不等于已购买、已实现或已通过实机验证。*
