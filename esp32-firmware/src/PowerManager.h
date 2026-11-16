#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include "esp_bt.h"
#include "esp_sleep.h"

/**
 * ESP32 MiniCast — Power & Battery Management (18650 1200mAh Li-Ion)
 *
 * IMPORTANT HARDWARE NOTE ON BLUETOOTH CLASSIC SPP & SLEEP MODES:
 * On the original ESP32-WROOM-32, Bluetooth Classic (BR/EDR SPP) maintains an
 * active ACL link with periodic sniff/poll intervals.
 * - Deep Sleep (`esp_deep_sleep_start`) powers down the Bluetooth baseband radio,
 *   which drops the Android SPP socket until the ESP32 reboots and reconnects.
 * - Therefore, MiniCast uses a tiered strategy:
 *   1. ACTIVE_EYE / CUSTOM_DISPLAY: OLED on at configured contrast (0x81),
 *      CPU at 80 MHz (cuts active ESP32 current from ~130mA to ~75mA while keeping
 *      60fps I2C OLED rendering smooth).
 *   2. LOW_POWER_SLEEP (Connected Standby): OLED panel powered off (`SSD1306_DISPLAYOFF`
 *      reduces OLED draw from ~15mA to <0.02mA), CPU at 80 MHz (minimum for BT Classic),
 *      BT Modem Sleep enabled (`esp_bt_sleep_enable()`). SPP stays connected and wakes
 *      immediately on `EYE|WAKE` or any command from Android!
 *   3. OPTIONAL DEEP SLEEP: Can be triggered via touch/GPIO wake pin when disconnected
 *      for extended periods, dropping ESP32 draw to ~10-150 uA.
 */

class PowerManager {
public:
  static constexpr uint8_t BATTERY_ADC_PIN = 34; // Optional 100k/100k divider from VBAT
  static constexpr uint8_t WAKE_TOUCH_GPIO = 4;  // Capacitive touch T0 wake pin

  void begin(Adafruit_SSD1306* display) {
    _display = display;
    // Drop CPU from 240MHz to 80MHz: full BT Classic + I2C support with ~40% less power
    setCpuFrequencyMhz(80);
    esp_bt_sleep_enable();
    analogReadResolution(12);
  }

  void enterLowPowerSleep() {
    if (_isSleeping) return;
    _isSleeping = true;
    if (_display) {
      setOledContrast(0);
      _display->ssd1306_command(SSD1306_DISPLAYOFF);
    }
    setCpuFrequencyMhz(80);
  }

  void wakeFromSleep(uint8_t targetContrast) {
    if (!_isSleeping) return;
    _isSleeping = false;
    if (_display) {
      _display->ssd1306_command(SSD1306_DISPLAYON);
      setOledContrast(targetContrast);
    }
  }

  void setOledContrast(uint8_t contrast) {
    if (!_display) return;
    _display->ssd1306_command(SSD1306_SETCONTRAST);
    _display->ssd1306_command(contrast);
  }

  bool isSleeping() const { return _isSleeping; }

  // Reads 18650 cell voltage via 1:1 resistor divider on GPIO 34 (if wired).
  // Returns estimated percentage (0..100) and millivolts.
  void readBattery(uint8_t& outPercent, uint16_t& outMillivolts) {
    uint32_t mv = analogReadMilliVolts(BATTERY_ADC_PIN) * 2; // 100k/100k divider
    if (mv < 2500 || mv > 4500) {
      // Pin likely floating / USB-powered without divider; report USB nominal
      outMillivolts = 4150;
      outPercent = 100;
      return;
    }
    outMillivolts = static_cast<uint16_t>(mv);
    if (mv >= 4200) outPercent = 100;
    else if (mv <= 3200) outPercent = 0;
    else {
      // Piece-wise linear 18650 Li-Ion discharge curve approximation
      outPercent = static_cast<uint8_t>(((mv - 3200) * 100UL) / 1000UL);
    }
  }

private:
  Adafruit_SSD1306* _display = nullptr;
  bool _isSleeping = false;
};
