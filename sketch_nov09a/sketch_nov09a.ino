
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

// DHT11
#define DHT_PIN 4
#define DHT_TYPE DHT11

// Photoresistor DO
#define LIGHT_PIN 23

// OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

DHT dht(DHT_PIN, DHT_TYPE);

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

void setup() {
  Serial.begin(115200);

  dht.begin();

  // Digital input
  pinMode(LIGHT_PIN, INPUT);

  Wire.begin(21, 22);

  if (!display.begin(
    SSD1306_SWITCHCAPVCC,
    OLED_ADDRESS
  )) {
    Serial.println("OLED initialization failed!");
    while (true);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(15, 20);
  display.println("ESP32 Monitor");
  display.setCursor(15, 35);
  display.println("Starting...");
  display.display();

  delay(2000);
}

void loop() {

  // Read DHT11
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Read Photoresistor DO
  int lightState = digitalRead(LIGHT_PIN);

  // Determine light status
  // Logic depends on your module
  String lightStatus;

  if (lightState == LOW) {
    lightStatus = "BRIGHT";
  } else {
    lightStatus = "DARK";
  }

  // Check DHT11
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 reading failed!");
    delay(2000);
    return;
  }

  // Serial Monitor
  Serial.println("===== Environment Monitor =====");

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" C");

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("Light DO: ");
  Serial.println(lightState);

  Serial.print("Light Status: ");
  Serial.println(lightStatus);

  Serial.println("===============================");

  // OLED
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(10, 0);
  display.println("ENVIRONMENT MONITOR");

  display.drawLine(0, 12, 127, 12, SSD1306_WHITE);

  display.setCursor(5, 18);
  display.print("Temp: ");
  display.print(temperature, 1);
  display.println(" C");

  display.setCursor(5, 32);
  display.print("Humidity: ");
  display.print(humidity, 0);
  display.println(" %");

  display.setCursor(5, 48);
  display.print("Light: ");
  display.println(lightStatus);

  display.display();

  delay(2000);
}
