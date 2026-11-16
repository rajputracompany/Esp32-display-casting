# ESP32 MiniCast — Complete Build, Flash & Testing Guide

## 1. Hardware Wiring (Original ESP32 DevKit V1 · ESP32-WROOM-32)
> **Important:** Must use the original ESP32 (`ESP32-WROOM-32`) with Bluetooth Classic BR/EDR (`BluetoothSerial`). ESP32-C3, ESP32-S3, and ESP8266 do not have Bluetooth Classic SPP hardware.

| SSD1306 128x64 OLED Pin | ESP32 DevKit V1 Pin | Notes |
|---|---|---|
| `VCC` | `3V3` | 3.3V regulated supply |
| `GND` | `GND` | Common ground |
| `SDA` | `GPIO 21` | Default I2C data |
| `SCL` | `GPIO 22` | Default I2C clock |

Optional 18650 (1200mAh) Battery Voltage Sense: connect a 100kΩ / 100kΩ resistor divider from `VBAT+` to `GPIO 34` and `GND`.

---

## 2. Flashing the ESP32 Firmware

### Option A: PlatformIO (Recommended)
1. Open `esp32-firmware/` in VS Code with PlatformIO installed.
2. Connect ESP32 DevKit V1 over USB.
3. Run:
   ```bash
   pio run -t upload
   pio device monitor -b 115200
   ```

### Option B: Arduino IDE 2.x
1. Install **esp32** board package by Espressif Systems (`ESP32 Dev Module`).
2. Install libraries via Library Manager: **Adafruit SSD1306** and **Adafruit GFX Library**.
3. Open `esp32-firmware/src/ESP32_MiniCast.ino` (keeping `Protocol.h`, `PowerManager.h`, `EyeRenderer.h`, `EyeRenderer.cpp` in the same folder).
4. Select `ESP32 Dev Module`, Partition Scheme: `Default 4MB with spiffs` (or `Huge APP`), and click **Upload**.

---

## 3. Building the Android APK

### Option A: Android Studio (Ladybug / Hedgehog or newer)
1. Open `android-project/ESP32MiniCast/` in Android Studio.
2. Wait for Gradle Sync (compileSdk 35, Kotlin 2.0.21, Compose BOM 2024.10.01).
3. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. Locate output at `app/build/outputs/apk/debug/app-debug.apk`.

### Option B: Command Line
```bash
cd android-project/ESP32MiniCast
gradle wrapper   # if gradlew is not yet generated locally
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

---

## 4. Physical Device Testing Checklist
1. Power on ESP32: verify OLED wakes with smooth opening eye animation and transitions to natural idle saccades & blinks.
2. Pair `ESP32-MiniCast` once in Android Bluetooth Settings.
3. Open **ESP32 MiniCast** Android app → Grant Bluetooth permissions → Tap **Scan Paired Bluetooth Devices** → Tap `ESP32-MiniCast`.
4. Verify connection status switches to Connected and live battery/mode telemetry appears.
5. Test all 8 expressions (`Happy`, `Excited`, `Curious`, `Sleepy`, `Surprised`, `Sad`, `Angry`, `Neutral`), `Blink`, `Look Left/Center/Right`.
6. Send static & scrolling text from **Display Studio → Text**; verify automatic return to Robotic Eye after timeout.
7. Pick a photo in **Display Studio → Image**, adjust contrast/threshold/dither, and verify chunked `IMG_START`/`IMG_DATA`/`IMG_END` transfer renders crisp 1-bit monochrome pixels on the SSD1306.
8. Wait for sleep timeout (or tap `Sleep`): verify eyelid closes gently and SSD1306 enters `DISPLAYOFF` low-power standby while Bluetooth SPP stays responsive to `Wake Up`.
