/**
 * ESP32 MiniCast Firmware v1.2.0
 * Hardware: Original ESP32 DevKit V1 (ESP32-WROOM-32)
 * Display:  1-inch Monochrome OLED 128x64 (SSD1306 I2C)
 * Pins:     SDA = GPIO 21, SCL = GPIO 22, I2C Addr = 0x3C (configurable)
 * Radio:    Bluetooth Classic SPP (BluetoothSerial)
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <BluetoothSerial.h>

#include "Protocol.h"
#include "EyeRenderer.h"
#include "PowerManager.h"

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error "Bluetooth Classic is not enabled in sdkconfig! Use Original ESP32-WROOM-32."
#endif

static constexpr uint8_t OLED_SDA_PIN = 21;
static constexpr uint8_t OLED_SCL_PIN = 22;
static constexpr uint8_t OLED_I2C_ADDR = 0x3C; // Change to 0x3D if your SSD1306 uses 0x3D

Adafruit_SSD1306 display(MiniCastProtocol::OLED_WIDTH, MiniCastProtocol::OLED_HEIGHT, &Wire, -1);
BluetoothSerial SerialBT;
EyeRenderer eyeRenderer;
PowerManager powerMgr;

// Configurable runtime settings
struct MiniCastConfig {
  String deviceName = "ESP32-MiniCast";
  uint32_t sleepTimeoutMs = 45000;      // Inactivity before SLEEP_ANIMATION
  uint32_t customDisplayMs = 20000;     // Duration before custom display returns to eye
  uint8_t animSpeed = 6;                // 1..10
  uint8_t oledContrast = 200;           // 0..255
  uint8_t scrollSpeed = 3;              // px per frame
  bool wakeAnimEnabled = true;
  EyeExpression defaultExpr = EyeExpression::NEUTRAL;
} cfg;

// Active display mode inside CUSTOM_DISPLAY
enum class CustomMode : uint8_t {
  NONE = 0,
  STATIC_TEXT,
  SCROLL_TEXT,
  BITMAP,
  BUILTIN_ANIM
};

CustomMode activeCustomMode = CustomMode::NONE;
MiniCastProtocol::DeviceState deviceState = MiniCastProtocol::DeviceState::BOOT;
uint32_t lastActivityMs = 0;
uint32_t stateEnteredMs = 0;

// Text / Scroll state
String currentText = "";
String textAlign = "CENTER";
int16_t scrollX = 128;

// Built-in animation state
String activeAnimName = "ORB";
float animPhase = 0.0f;

// Bitmap transfer buffer (128x64 monochrome = 1024 bytes)
uint8_t frameBuffer[MiniCastProtocol::FRAME_BYTES];
uint8_t rxBitmap[MiniCastProtocol::FRAME_BYTES];
bool rxActive = false;
uint32_t rxExpectedCrc = 0;
uint16_t rxBytesReceived = 0;

// Line buffer for Bluetooth SPP
String btLineBuffer;

void setState(MiniCastProtocol::DeviceState next) {
  deviceState = next;
  stateEnteredMs = millis();
  if (next == MiniCastProtocol::DeviceState::WAKE_ANIMATION) {
    powerMgr.wakeFromSleep(cfg.oledContrast);
    activeCustomMode = CustomMode::NONE;
    if (cfg.wakeAnimEnabled) {
      eyeRenderer.triggerWakeSequence();
    } else {
      eyeRenderer.setExpression(cfg.defaultExpr);
      deviceState = MiniCastProtocol::DeviceState::IDLE_EYE;
    }
  } else if (next == MiniCastProtocol::DeviceState::IDLE_EYE) {
    activeCustomMode = CustomMode::NONE;
    eyeRenderer.setExpression(cfg.defaultExpr);
  } else if (next == MiniCastProtocol::DeviceState::SLEEP_ANIMATION) {
    activeCustomMode = CustomMode::NONE;
    eyeRenderer.triggerSleepSequence();
  } else if (next == MiniCastProtocol::DeviceState::LOW_POWER_SLEEP) {
    powerMgr.enterLowPowerSleep();
  }
}

void wakeIfSleeping() {
  lastActivityMs = millis();
  if (deviceState == MiniCastProtocol::DeviceState::LOW_POWER_SLEEP ||
      deviceState == MiniCastProtocol::DeviceState::SLEEP_ANIMATION) {
    setState(MiniCastProtocol::DeviceState::WAKE_ANIMATION);
  }
}

void sendStatus() {
  uint8_t battPct = 100;
  uint16_t battMv = 4150;
  powerMgr.readBattery(battPct, battMv);
  const char* modeStr = "EYE";
  if (activeCustomMode == CustomMode::STATIC_TEXT) modeStr = "TEXT";
  else if (activeCustomMode == CustomMode::SCROLL_TEXT) modeStr = "SCROLL";
  else if (activeCustomMode == CustomMode::BITMAP) modeStr = "IMAGE";
  else if (activeCustomMode == CustomMode::BUILTIN_ANIM) modeStr = "ANIM";

  String msg = "STATUS|STATE=";
  msg += MiniCastProtocol::stateToString(deviceState);
  msg += "|EXPR=";
  msg += eyeRenderer.expressionName();
  msg += "|MODE=";
  msg += modeStr;
  msg += "|BATT=";
  msg += String(battPct);
  msg += "|VOLT=";
  msg += String(battMv);
  msg += "|FW=";
  msg += MiniCastProtocol::FW_VERSION;
  msg += "|UPTIME=";
  msg += String(millis() / 1000UL);
  SerialBT.println(msg);
}

void renderStaticText() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(true);
  display.setTextSize(currentText.length() <= 16 ? 2 : 1);

  int16_t x1, y1;
  uint16_t tw, th;
  display.getTextBounds(currentText, 0, 0, &x1, &y1, &tw, &th);
  int16_t x = 4;
  if (textAlign == "CENTER" && tw < 124) x = (128 - static_cast<int16_t>(tw)) / 2;
  else if (textAlign == "RIGHT" && tw < 124) x = 124 - static_cast<int16_t>(tw);
  int16_t y = max(4, (64 - static_cast<int16_t>(th)) / 2);

  display.setCursor(x, y);
  display.print(currentText);
  display.display();
}

void renderScrollText() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(false);
  display.setTextSize(2);

  int16_t x1, y1;
  uint16_t tw, th;
  display.getTextBounds(currentText, 0, 0, &x1, &y1, &tw, &th);
  display.setCursor(scrollX, 24);
  display.print(currentText);
  display.display();

  scrollX -= cfg.scrollSpeed;
  if (scrollX < -static_cast<int16_t>(tw) - 8) {
    scrollX = 128;
  }
}

void renderBuiltinAnimation() {
  display.clearDisplay();
  animPhase += 0.08f * (cfg.animSpeed / 5.0f);

  if (activeAnimName == "ORB") {
    int16_t x = 64 + static_cast<int16_t>(cosf(animPhase) * 44.0f);
    int16_t y = 32 + static_cast<int16_t>(sinf(animPhase * 1.7f) * 18.0f);
    display.fillCircle(x, y, 8, SSD1306_WHITE);
    display.drawCircle(x, y, 13, SSD1306_WHITE);
  } else if (activeAnimName == "HEARTBEAT") {
    for (int16_t x = 0; x < 128; ++x) {
      float p = fmodf((x * 0.09f) - animPhase * 2.0f, 6.283f);
      if (p < 0) p += 6.283f;
      int16_t y = 32;
      if (p > 2.5f && p < 2.9f) y = 14;
      else if (p >= 2.9f && p < 3.2f) y = 50;
      else if (p >= 3.2f && p < 3.6f) y = 24;
      display.drawPixel(x, y, SSD1306_WHITE);
    }
  } else if (activeAnimName == "AUDIO_BARS") {
    for (uint8_t i = 0; i < 16; ++i) {
      uint8_t h = 8 + static_cast<uint8_t>((sinf(animPhase * 2.0f + i * 0.65f) + 1.0f) * 24.0f);
      display.fillRect(i * 8 + 1, 64 - h, 6, h, SSD1306_WHITE);
    }
  } else {
    // STARFIELD / MATRIX fallback
    for (uint8_t i = 0; i < 24; ++i) {
      int16_t sx = (i * 37 + static_cast<int16_t>(animPhase * 18.0f * ((i % 3) + 1))) % 128;
      int16_t sy = (i * 19) % 64;
      display.fillRect(sx, sy, 2, 2, SSD1306_WHITE);
    }
  }
  display.display();
}

void handleCommand(const String& rawLine) {
  String line = rawLine;
  line.trim();
  if (line.isEmpty()) return;

  int firstSep = line.indexOf('|');
  String cmd = (firstSep < 0) ? line : line.substring(0, firstSep);
  String rest = (firstSep < 0) ? "" : line.substring(firstSep + 1);
  cmd.toUpperCase();

  if (cmd == "PING") {
    SerialBT.println("OK|PONG");
    return;
  }

  if (cmd == "STATUS") {
    sendStatus();
    return;
  }

  wakeIfSleeping();

  if (cmd == "CLEAR") {
    activeCustomMode = CustomMode::NONE;
    display.clearDisplay();
    display.display();
    SerialBT.println("OK|CLEAR");
    return;
  }

  if (cmd == "TEXT") {
    int alignSep = rest.indexOf('|');
    if (alignSep > 0) {
      String maybeAlign = rest.substring(0, alignSep);
      maybeAlign.toUpperCase();
      if (maybeAlign == "LEFT" || maybeAlign == "CENTER" || maybeAlign == "RIGHT") {
        textAlign = maybeAlign;
        currentText = rest.substring(alignSep + 1);
      } else {
        textAlign = "CENTER";
        currentText = rest;
      }
    } else {
      textAlign = "CENTER";
      currentText = rest;
    }
    activeCustomMode = CustomMode::STATIC_TEXT;
    setState(MiniCastProtocol::DeviceState::CUSTOM_DISPLAY);
    renderStaticText();
    SerialBT.println("OK|TEXT");
    return;
  }

  if (cmd == "SCROLL") {
    int spdSep = rest.indexOf('|');
    if (spdSep > 0) {
      int spd = rest.substring(0, spdSep).toInt();
      if (spd >= 1 && spd <= 10) {
        cfg.scrollSpeed = static_cast<uint8_t>(spd);
        currentText = rest.substring(spdSep + 1);
      } else {
        currentText = rest;
      }
    } else {
      currentText = rest;
    }
    scrollX = 128;
    activeCustomMode = CustomMode::SCROLL_TEXT;
    setState(MiniCastProtocol::DeviceState::CUSTOM_DISPLAY);
    SerialBT.println("OK|SCROLL");
    return;
  }

  if (cmd == "EYE") {
    String arg = rest;
    arg.toUpperCase();
    arg.trim();
    if (arg == "BLINK") {
      setState(MiniCastProtocol::DeviceState::IDLE_EYE);
      eyeRenderer.triggerBlink();
    } else if (arg == "SLEEP") {
      setState(MiniCastProtocol::DeviceState::SLEEP_ANIMATION);
    } else if (arg == "WAKE") {
      setState(MiniCastProtocol::DeviceState::WAKE_ANIMATION);
    } else if (arg == "IDLE") {
      eyeRenderer.setIdleEnabled(true);
      setState(MiniCastProtocol::DeviceState::IDLE_EYE);
    } else if (arg == "LOOK_LEFT") {
      setState(MiniCastProtocol::DeviceState::IDLE_EYE);
      eyeRenderer.setLook(-0.9f, 0.0f);
    } else if (arg == "LOOK_RIGHT") {
      setState(MiniCastProtocol::DeviceState::IDLE_EYE);
      eyeRenderer.setLook(0.9f, 0.0f);
    } else if (arg == "LOOK_CENTER") {
      setState(MiniCastProtocol::DeviceState::IDLE_EYE);
      eyeRenderer.setLook(0.0f, 0.0f);
    } else {
      EyeExpression expr;
      if (EyeRenderer::parseExpression(arg, expr)) {
        activeCustomMode = CustomMode::NONE;
        deviceState = MiniCastProtocol::DeviceState::IDLE_EYE;
        stateEnteredMs = millis();
        eyeRenderer.setExpression(expr);
      } else {
        SerialBT.println("ERR|BAD_EXPR|" + arg);
        return;
      }
    }
    SerialBT.println("OK|EYE|" + arg);
    return;
  }

  // Backward-compatible direct shorthand commands
  if (cmd == "NEUTRAL" || cmd == "HAPPY" || cmd == "EXCITED" || cmd == "CURIOUS" ||
      cmd == "SLEEPY" || cmd == "SURPRISED" || cmd == "SAD" || cmd == "ANGRY") {
    EyeExpression expr;
    EyeRenderer::parseExpression(cmd, expr);
    activeCustomMode = CustomMode::NONE;
    deviceState = MiniCastProtocol::DeviceState::IDLE_EYE;
    stateEnteredMs = millis();
    eyeRenderer.setExpression(expr);
    SerialBT.println("OK|EYE|" + cmd);
    return;
  }

  if (cmd == "ANIM") {
    String a = rest;
    a.toUpperCase();
    a.trim();
    if (a == "STOP") {
      setState(MiniCastProtocol::DeviceState::IDLE_EYE);
    } else {
      activeAnimName = a;
      animPhase = 0.0f;
      activeCustomMode = CustomMode::BUILTIN_ANIM;
      setState(MiniCastProtocol::DeviceState::CUSTOM_DISPLAY);
    }
    SerialBT.println("OK|ANIM|" + a);
    return;
  }

  if (cmd == "CFG") {
    int sep = rest.indexOf('|');
    if (sep < 0) {
      SerialBT.println("ERR|BAD_CFG|Missing value");
      return;
    }
    String key = rest.substring(0, sep);
    String val = rest.substring(sep + 1);
    key.toUpperCase();

    if (key == "SLEEP_MS") cfg.sleepTimeoutMs = max(5000L, val.toInt());
    else if (key == "DISPLAY_MS") cfg.customDisplayMs = max(3000L, val.toInt());
    else if (key == "SPEED") {
      cfg.animSpeed = constrain(val.toInt(), 1, 10);
      eyeRenderer.setSpeed(cfg.animSpeed);
    } else if (key == "CONTRAST") {
      cfg.oledContrast = constrain(val.toInt(), 0, 255);
      powerMgr.setOledContrast(cfg.oledContrast);
    } else if (key == "WAKE_ANIM") {
      cfg.wakeAnimEnabled = (val == "1" || val == "true");
    } else if (key == "DEFAULT_EXPR") {
      EyeRenderer::parseExpression(val, cfg.defaultExpr);
    }
    SerialBT.println("OK|CFG|" + key);
    return;
  }

  // Chunked 128x64 Bitmap Transfer:
  // IMG_START|<width>|<height>|<totalBytes>|<chunkSize>|<crc32Hex>
  if (cmd == "IMG_START") {
    int p1 = rest.indexOf('|');
    int p2 = rest.indexOf('|', p1 + 1);
    int p3 = rest.indexOf('|', p2 + 1);
    int p4 = rest.indexOf('|', p3 + 1);
    if (p1 < 0 || p2 < 0 || p3 < 0 || p4 < 0) {
      SerialBT.println("ERR|IMG_META|Malformed header");
      return;
    }
    int w = rest.substring(0, p1).toInt();
    int h = rest.substring(p1 + 1, p2).toInt();
    int totalBytes = rest.substring(p2 + 1, p3).toInt();
    String crcStr = rest.substring(p4 + 1);

    if (w != 128 || h != 64 || totalBytes != MiniCastProtocol::FRAME_BYTES) {
      SerialBT.println("ERR|IMG_SIZE|Expected 128x64 (1024 bytes)");
      return;
    }
    rxExpectedCrc = strtoul(crcStr.c_str(), nullptr, 16);
    rxBytesReceived = 0;
    rxActive = true;
    memset(rxBitmap, 0, sizeof(rxBitmap));
    SerialBT.println("OK|IMG_START");
    return;
  }

  // IMG_DATA|<offsetBytes>|<hexPayload>|<xorHex>
  if (cmd == "IMG_DATA") {
    if (!rxActive) {
      SerialBT.println("NAK|0|NO_SESSION");
      return;
    }
    int p1 = rest.indexOf('|');
    int p2 = rest.indexOf('|', p1 + 1);
    if (p1 < 0 || p2 < 0) {
      SerialBT.println("NAK|0|MALFORMED");
      return;
    }
    int chunkIndex = rest.substring(0, p1).toInt();
    String hexPayload = rest.substring(p1 + 1, p2);
    uint8_t expectedXor = static_cast<uint8_t>(strtoul(rest.substring(p2 + 1).c_str(), nullptr, 16));

    uint8_t temp[128];
    size_t decodedLen = 0;
    if (!MiniCastProtocol::decodeHex(hexPayload, temp, sizeof(temp), decodedLen)) {
      SerialBT.println("NAK|" + String(chunkIndex) + "|HEX_ERR");
      return;
    }
    if (MiniCastProtocol::xorChecksum(temp, decodedLen) != expectedXor) {
      SerialBT.println("NAK|" + String(chunkIndex) + "|XOR_MISMATCH");
      return;
    }
    size_t offset = static_cast<size_t>(chunkIndex) * 64;
    if (offset + decodedLen > MiniCastProtocol::FRAME_BYTES) {
      SerialBT.println("NAK|" + String(chunkIndex) + "|BOUNDS");
      return;
    }
    memcpy(rxBitmap + offset, temp, decodedLen);
    rxBytesReceived = max<uint16_t>(rxBytesReceived, offset + decodedLen);
    SerialBT.println("ACK|" + String(chunkIndex));
    return;
  }

  // IMG_END|<crc32Hex>
  if (cmd == "IMG_END") {
    if (!rxActive) {
      SerialBT.println("ERR|IMG_END|NO_SESSION");
      return;
    }
    rxActive = false;
    uint32_t actualCrc = MiniCastProtocol::crc32(rxBitmap, MiniCastProtocol::FRAME_BYTES);
    if (actualCrc != rxExpectedCrc) {
      SerialBT.println("ERR|IMG_CRC|CRC mismatch");
      return;
    }
    memcpy(frameBuffer, rxBitmap, MiniCastProtocol::FRAME_BYTES);
    activeCustomMode = CustomMode::BITMAP;
    setState(MiniCastProtocol::DeviceState::CUSTOM_DISPLAY);
    display.clearDisplay();
    display.drawBitmap(0, 0, frameBuffer, 128, 64, SSD1306_WHITE);
    display.display();
    SerialBT.println("OK|IMG_END");
    return;
  }

  SerialBT.println("ERR|UNKNOWN_CMD|" + cmd);
}

void setup() {
  Serial.begin(115200);
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("[MiniCast] SSD1306 allocation/I2C failed!");
    for (;;) delay(1000);
  }

  powerMgr.begin(&display);
  powerMgr.setOledContrast(cfg.oledContrast);
  eyeRenderer.begin(&display);
  eyeRenderer.setSpeed(cfg.animSpeed);

  SerialBT.begin(cfg.deviceName);
  Serial.println("[MiniCast] Bluetooth Classic SPP started: " + cfg.deviceName);

  lastActivityMs = millis();
  setState(MiniCastProtocol::DeviceState::WAKE_ANIMATION);
}

void loop() {
  uint32_t now = millis();

  // 1. Read incoming Bluetooth Classic SPP lines without blocking
  while (SerialBT.available()) {
    char c = static_cast<char>(SerialBT.read());
    if (c == '\n') {
      handleCommand(btLineBuffer);
      btLineBuffer = "";
    } else if (c != '\r') {
      if (btLineBuffer.length() < 512) btLineBuffer += c;
    }
  }

  // 2. State Machine Transitions
  switch (deviceState) {
    case MiniCastProtocol::DeviceState::WAKE_ANIMATION:
      eyeRenderer.update(now);
      if (eyeRenderer.isWakeOpenComplete()) {
        setState(MiniCastProtocol::DeviceState::IDLE_EYE);
      }
      break;

    case MiniCastProtocol::DeviceState::IDLE_EYE:
      eyeRenderer.update(now);
      if (now - lastActivityMs >= cfg.sleepTimeoutMs) {
        setState(MiniCastProtocol::DeviceState::SLEEP_ANIMATION);
      }
      break;

    case MiniCastProtocol::DeviceState::CUSTOM_DISPLAY:
      if (activeCustomMode == CustomMode::SCROLL_TEXT) {
        renderScrollText();
      } else if (activeCustomMode == CustomMode::BUILTIN_ANIM) {
        renderBuiltinAnimation();
      }
      if (now - stateEnteredMs >= cfg.customDisplayMs) {
        setState(MiniCastProtocol::DeviceState::IDLE_EYE);
      }
      break;

    case MiniCastProtocol::DeviceState::SLEEP_ANIMATION:
      eyeRenderer.update(now);
      if (eyeRenderer.isSleepCloseComplete()) {
        setState(MiniCastProtocol::DeviceState::LOW_POWER_SLEEP);
      }
      break;

    case MiniCastProtocol::DeviceState::LOW_POWER_SLEEP:
      // BT Modem Sleep active; low polling delay
      delay(40);
      return;

    default:
      setState(MiniCastProtocol::DeviceState::IDLE_EYE);
      break;
  }

  delay(22); // ~45 fps OLED refresh
}
