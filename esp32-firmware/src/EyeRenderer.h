#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

/**
 * ESP32 MiniCast — Parametric Robotic Eye Animation Engine (128x64 Monochrome SSD1306)
 *
 * Uses a unified parametric EyeParams model rather than per-expression drawing routines.
 * Every expression is a compact target pose interpolated smoothly in real time.
 */

enum class EyeExpression : uint8_t {
  NEUTRAL = 0,
  HAPPY,
  EXCITED,
  CURIOUS,
  SLEEPY,
  SURPRISED,
  SAD,
  ANGRY
};

struct EyeParams {
  float width;        // Outer eye width in px (0..112)
  float height;       // Outer eye height in px (0..58)
  float cornerRadius; // Rounded rect radius
  float topLid;       // 0.0 (open) .. 1.0 (closed from top)
  float bottomLid;    // 0.0 (open) .. 1.0 (closed from bottom, e.g., happy squint)
  float upperSlant;   // -1.0 (angry inward) .. +1.0 (sad outward)
  float pupilX;       // Normalized gaze X (-1.0 left .. +1.0 right)
  float pupilY;       // Normalized gaze Y (-1.0 up .. +1.0 down)
  float pupilRadius;  // Inner dark pupil radius in px
  float bounceY;      // Vertical expression offset in px
};

class EyeRenderer {
public:
  void begin(Adafruit_SSD1306* display);

  void setExpression(EyeExpression expr);
  EyeExpression getExpression() const { return _targetExpr; }
  const char* expressionName() const;
  static bool parseExpression(const String& name, EyeExpression& out);

  void setSpeed(uint8_t speed1to10);
  void setIdleEnabled(bool enabled) { _idleEnabled = enabled; }
  void setLook(float gazeX, float gazeY, uint32_t holdMs = 3500);
  void triggerBlink();
  void triggerWakeSequence();
  void triggerSleepSequence();

  // Advances interpolation, blinking, and natural saccades, then draws to OLED
  void update(uint32_t nowMs);
  void render();

  bool isSleepCloseComplete() const { return _sleepAnimDone; }
  bool isWakeOpenComplete() const { return _wakeAnimDone; }

private:
  Adafruit_SSD1306* _display = nullptr;

  EyeExpression _targetExpr = EyeExpression::NEUTRAL;
  EyeParams _current{};
  EyeParams _target{};

  // Gaze & saccade state
  float _gazeX = 0.0f;
  float _gazeY = 0.0f;
  float _targetGazeX = 0.0f;
  float _targetGazeY = 0.0f;
  uint32_t _nextSaccadeMs = 0;
  uint32_t _manualGazeUntilMs = 0;

  // Blink state
  bool _blinking = false;
  uint32_t _blinkStartMs = 0;
  uint32_t _blinkDurationMs = 190;
  uint32_t _nextBlinkMs = 2400;
  uint8_t _doubleBlinkRemaining = 0;

  // Wake / Sleep transitions
  bool _inWakeAnim = false;
  bool _wakeAnimDone = false;
  uint32_t _wakeStartMs = 0;

  bool _inSleepAnim = false;
  bool _sleepAnimDone = false;
  uint32_t _sleepStartMs = 0;

  bool _idleEnabled = true;
  float _lerpRate = 0.16f;
  uint32_t _lastFrameMs = 0;

  static EyeParams presetFor(EyeExpression expr);
  static float lerpf(float a, float b, float t) { return a + (b - a) * t; }
};
