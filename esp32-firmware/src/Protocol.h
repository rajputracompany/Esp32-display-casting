#pragma once
#include <Arduino.h>

/**
 * ESP32 MiniCast — Shared Bluetooth Classic SPP Protocol Specification (v1.2.0)
 * Must match Android BluetoothProtocol.kt byte-for-byte.
 *
 * Transport: Bluetooth Classic SPP (RFCOMM UUID 00001101-0000-1000-8000-00805F9B34FB)
 * Framing:   Newline-delimited UTF-8 commands ('\n')
 * Fields:    Pipe-delimited ('|')
 */

namespace MiniCastProtocol {

static constexpr const char* FW_VERSION = "1.2.0";
static constexpr uint16_t OLED_WIDTH = 128;
static constexpr uint16_t OLED_HEIGHT = 64;
static constexpr size_t FRAME_BYTES = (OLED_WIDTH * OLED_HEIGHT) / 8; // 1024 bytes

// System States
enum class DeviceState : uint8_t {
  BOOT = 0,
  WAKE_ANIMATION,
  IDLE_EYE,
  CUSTOM_DISPLAY,
  INACTIVITY_TIMEOUT,
  SLEEP_ANIMATION,
  LOW_POWER_SLEEP
};

inline const char* stateToString(DeviceState s) {
  switch (s) {
    case DeviceState::BOOT:               return "BOOT";
    case DeviceState::WAKE_ANIMATION:     return "WAKE_ANIMATION";
    case DeviceState::IDLE_EYE:           return "IDLE_EYE";
    case DeviceState::CUSTOM_DISPLAY:     return "CUSTOM_DISPLAY";
    case DeviceState::INACTIVITY_TIMEOUT: return "INACTIVITY_TIMEOUT";
    case DeviceState::SLEEP_ANIMATION:    return "SLEEP_ANIMATION";
    case DeviceState::LOW_POWER_SLEEP:    return "LOW_POWER_SLEEP";
    default:                              return "UNKNOWN";
  }
}

// IEEE 802.3 CRC32 for full-frame bitmap integrity verification
inline uint32_t crc32(const uint8_t* data, size_t length) {
  uint32_t crc = 0xFFFFFFFFUL;
  for (size_t i = 0; i < length; ++i) {
    crc ^= data[i];
    for (uint8_t b = 0; b < 8; ++b) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xEDB88320UL;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc ^ 0xFFFFFFFFUL;
}

// Per-chunk XOR checksum
inline uint8_t xorChecksum(const uint8_t* data, size_t length) {
  uint8_t x = 0;
  for (size_t i = 0; i < length; ++i) x ^= data[i];
  return x;
}

inline int hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return -1;
}

inline bool decodeHex(const String& hex, uint8_t* out, size_t maxOut, size_t& decodedLen) {
  if (hex.length() % 2 != 0) return false;
  size_t bytes = hex.length() / 2;
  if (bytes > maxOut) return false;
  for (size_t i = 0; i < bytes; ++i) {
    int hi = hexNibble(hex[i * 2]);
    int lo = hexNibble(hex[i * 2 + 1]);
    if (hi < 0 || lo < 0) return false;
    out[i] = static_cast<uint8_t>((hi << 4) | lo);
  }
  decodedLen = bytes;
  return true;
}

} // namespace MiniCastProtocol
