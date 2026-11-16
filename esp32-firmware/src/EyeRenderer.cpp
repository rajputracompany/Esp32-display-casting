#include "EyeRenderer.h"
#include <math.h>

void EyeRenderer::begin(Adafruit_SSD1306* display) {
  _display = display;
  _targetExpr = EyeExpression::NEUTRAL;
  _target = presetFor(_targetExpr);
  _current = _target;
  _current.topLid = 1.0f; // Start closed for boot wake-up
  _lastFrameMs = millis();
  _nextBlinkMs = millis() + 2200;
  _nextSaccadeMs = millis() + 1400;
}

EyeParams EyeRenderer::presetFor(EyeExpression expr) {
  switch (expr) {
    case EyeExpression::HAPPY:
      return { 76, 42, 18, 0.06f, 0.44f, 0.0f,  0.0f, -0.1f, 8.5f, -2.0f };
    case EyeExpression::EXCITED:
      return { 82, 50, 22, 0.00f, 0.28f, 0.0f,  0.0f, -0.15f, 11.5f, -3.0f };
    case EyeExpression::CURIOUS:
      return { 70, 44, 16, 0.04f, 0.02f, 0.22f, 0.35f, -0.2f, 9.5f, -1.0f };
    case EyeExpression::SLEEPY:
      return { 72, 34, 14, 0.56f, 0.12f, 0.10f, 0.0f, 0.25f, 7.5f, 3.0f };
    case EyeExpression::SURPRISED:
      return { 86, 54, 25, 0.00f, 0.00f, 0.0f,  0.0f, 0.0f,  6.0f, -2.0f };
    case EyeExpression::SAD:
      return { 68, 38, 16, 0.22f, 0.08f, 0.62f, -0.15f, 0.30f, 9.0f, 3.0f };
    case EyeExpression::ANGRY:
      return { 74, 38, 12, 0.24f, 0.06f, -0.72f, 0.0f, 0.05f, 7.5f, 1.0f };
    case EyeExpression::NEUTRAL:
    default:
      return { 70, 42, 16, 0.04f, 0.02f, 0.0f,  0.0f, 0.0f,  9.5f, 0.0f };
  }
}

void EyeRenderer::setExpression(EyeExpression expr) {
  _targetExpr = expr;
  _target = presetFor(expr);
  _inSleepAnim = false;
  _sleepAnimDone = false;
}

const char* EyeRenderer::expressionName() const {
  switch (_targetExpr) {
    case EyeExpression::HAPPY:     return "HAPPY";
    case EyeExpression::EXCITED:   return "EXCITED";
    case EyeExpression::CURIOUS:   return "CURIOUS";
    case EyeExpression::SLEEPY:    return "SLEEPY";
    case EyeExpression::SURPRISED: return "SURPRISED";
    case EyeExpression::SAD:       return "SAD";
    case EyeExpression::ANGRY:     return "ANGRY";
    case EyeExpression::NEUTRAL:
    default:                       return "NEUTRAL";
  }
}

bool EyeRenderer::parseExpression(const String& name, EyeExpression& out) {
  String u = name;
  u.toUpperCase();
  u.trim();
  if (u == "NEUTRAL")   { out = EyeExpression::NEUTRAL;   return true; }
  if (u == "HAPPY")     { out = EyeExpression::HAPPY;     return true; }
  if (u == "EXCITED")   { out = EyeExpression::EXCITED;   return true; }
  if (u == "CURIOUS")   { out = EyeExpression::CURIOUS;   return true; }
  if (u == "SLEEPY")    { out = EyeExpression::SLEEPY;    return true; }
  if (u == "SURPRISED") { out = EyeExpression::SURPRISED; return true; }
  if (u == "SAD")       { out = EyeExpression::SAD;       return true; }
  if (u == "ANGRY")     { out = EyeExpression::ANGRY;     return true; }
  return false;
}

void EyeRenderer::setSpeed(uint8_t speed1to10) {
  uint8_t clamped = constrain(speed1to10, 1, 10);
  _lerpRate = 0.06f + (clamped * 0.022f);
}

void EyeRenderer::setLook(float gazeX, float gazeY, uint32_t holdMs) {
  _targetGazeX = constrain(gazeX, -1.0f, 1.0f);
  _targetGazeY = constrain(gazeY, -1.0f, 1.0f);
  _manualGazeUntilMs = millis() + holdMs;
}

void EyeRenderer::triggerBlink() {
  if (!_blinking && !_inSleepAnim) {
    _blinking = true;
    _blinkStartMs = millis();
  }
}

void EyeRenderer::triggerWakeSequence() {
  _inWakeAnim = true;
  _wakeAnimDone = false;
  _inSleepAnim = false;
  _sleepAnimDone = false;
  _wakeStartMs = millis();
  _current.topLid = 1.0f;
  setExpression(EyeExpression::HAPPY);
}

void EyeRenderer::triggerSleepSequence() {
  _inSleepAnim = true;
  _sleepAnimDone = false;
  _inWakeAnim = false;
  _sleepStartMs = millis();
  setExpression(EyeExpression::SLEEPY);
}

void EyeRenderer::update(uint32_t nowMs) {
  float dtScale = constrain((nowMs - _lastFrameMs) / 16.67f, 0.2f, 3.0f);
  _lastFrameMs = nowMs;
  float alpha = constrain(_lerpRate * dtScale, 0.04f, 0.65f);

  // Wake sequence: gradually open eyelids, show happy expression, settle
  if (_inWakeAnim) {
    uint32_t elapsed = nowMs - _wakeStartMs;
    if (elapsed > 1400) {
      _inWakeAnim = false;
      _wakeAnimDone = true;
    }
  }

  // Sleep sequence: gradually droop and seal eye over 1.2s
  if (_inSleepAnim) {
    uint32_t elapsed = nowMs - _sleepStartMs;
    float p = constrain(elapsed / 1200.0f, 0.0f, 1.0f);
    _target.topLid = 0.55f + 0.45f * p;
    _target.bottomLid = 0.15f + 0.25f * p;
    if (p >= 1.0f) {
      _sleepAnimDone = true;
    }
  }

  // Natural non-repetitive idle saccades & blinks
  if (_idleEnabled && !_inSleepAnim) {
    if (nowMs >= _nextBlinkMs && !_blinking) {
      triggerBlink();
      if (_doubleBlinkRemaining == 0 && random(0, 100) < 22) {
        _doubleBlinkRemaining = 1;
        _nextBlinkMs = nowMs + 280;
      } else {
        _doubleBlinkRemaining = 0;
        _nextBlinkMs = nowMs + random(2200, 6200);
      }
    }

    if (nowMs >= _nextSaccadeMs && nowMs >= _manualGazeUntilMs) {
      // Controlled random saccade: bias near center with occasional wide glances
      float r = random(0, 100) / 100.0f;
      if (r < 0.35f) {
        _targetGazeX = 0.0f;
        _targetGazeY = 0.0f;
      } else {
        _targetGazeX = random(-85, 86) / 100.0f;
        _targetGazeY = random(-45, 46) / 100.0f;
      }
      _nextSaccadeMs = nowMs + random(900, 3200);
    }
  }

  // Interpolate parameters smoothly
  _current.width        = lerpf(_current.width, _target.width, alpha);
  _current.height       = lerpf(_current.height, _target.height, alpha);
  _current.cornerRadius = lerpf(_current.cornerRadius, _target.cornerRadius, alpha);
  _current.topLid       = lerpf(_current.topLid, _target.topLid, alpha);
  _current.bottomLid    = lerpf(_current.bottomLid, _target.bottomLid, alpha);
  _current.upperSlant   = lerpf(_current.upperSlant, _target.upperSlant, alpha);
  _current.pupilRadius  = lerpf(_current.pupilRadius, _target.pupilRadius, alpha);
  _current.bounceY      = lerpf(_current.bounceY, _target.bounceY, alpha);

  float gxTarget = (nowMs < _manualGazeUntilMs) ? _targetGazeX : (_targetGazeX + _target.pupilX * 0.4f);
  float gyTarget = (nowMs < _manualGazeUntilMs) ? _targetGazeY : (_targetGazeY + _target.pupilY * 0.4f);
  _gazeX = lerpf(_gazeX, constrain(gxTarget, -1.0f, 1.0f), alpha * 1.4f);
  _gazeY = lerpf(_gazeY, constrain(gyTarget, -1.0f, 1.0f), alpha * 1.4f);

  render();
}

void EyeRenderer::render() {
  if (!_display) return;
  _display->clearDisplay();

  // Compute active blink closure
  float blinkAmount = 0.0f;
  if (_blinking) {
    uint32_t elapsed = millis() - _blinkStartMs;
    if (elapsed >= _blinkDurationMs) {
      _blinking = false;
    } else {
      float half = _blinkDurationMs * 0.5f;
      blinkAmount = (elapsed < half)
        ? (elapsed / half)
        : (1.0f - (elapsed - half) / half);
    }
  }

  // Subtle organic breathing micro-motion
  float breathe = sinf(millis() * 0.0022f) * 1.0f;

  int16_t cx = 64 + static_cast<int16_t>(_gazeX * 7.0f);
  int16_t cy = 32 + static_cast<int16_t>(_current.bounceY + breathe + _gazeY * 3.5f);
  int16_t w = static_cast<int16_t>(_current.width);
  int16_t h = static_cast<int16_t>(_current.height);
  int16_t r = constrain(static_cast<int16_t>(_current.cornerRadius), 2, min(w, h) / 2);

  int16_t x0 = cx - w / 2;
  int16_t y0 = cy - h / 2;

  // 1. Draw glowing white sclera rounded eye
  _display->fillRoundRect(x0, y0, w, h, r, SSD1306_WHITE);

  // 2. Draw dark pupil + crisp specular highlight dot
  int16_t px = cx + static_cast<int16_t>(_gazeX * (w * 0.18f));
  int16_t py = cy + static_cast<int16_t>(_gazeY * (h * 0.16f));
  int16_t pr = static_cast<int16_t>(_current.pupilRadius);
  if (pr >= 3) {
    _display->fillCircle(px, py, pr, SSD1306_BLACK);
    // Specular reflection highlight inside upper-left of pupil
    _display->fillCircle(px - pr / 3, py - pr / 3, max(1, pr / 3), SSD1306_WHITE);
  }

  // 3. Apply top and bottom eyelids (combining expression lids + blink)
  float effTop = constrain(_current.topLid + blinkAmount * (1.0f - _current.topLid), 0.0f, 1.0f);
  float effBot = constrain(_current.bottomLid + blinkAmount * 0.15f, 0.0f, 1.0f);

  int16_t topCut = static_cast<int16_t>(h * effTop);
  int16_t botCut = static_cast<int16_t>(h * effBot);

  if (topCut > 0) {
    _display->fillRect(x0 - 2, y0 - 4, w + 4, topCut + 4, SSD1306_BLACK);
  }
  if (botCut > 0) {
    _display->fillRect(x0 - 2, y0 + h - botCut, w + 4, botCut + 4, SSD1306_BLACK);
  }

  // 4. Apply angled brow slant (angry inward or sad outward)
  if (fabsf(_current.upperSlant) > 0.05f) {
    int16_t slantDrop = static_cast<int16_t>(_current.upperSlant * 13.0f);
    int16_t topLineY = y0 + topCut;
    if (slantDrop < 0) {
      // Angry: outer edges stay high, inner/center dips
      int16_t dip = -slantDrop;
      _display->fillTriangle(x0, topLineY - 2, cx, topLineY + dip, x0 + w, topLineY - 2, SSD1306_BLACK);
    } else {
      // Sad: outer edges droop downward
      _display->fillTriangle(x0, topLineY - 2, x0, topLineY + slantDrop, cx, topLineY - 2, SSD1306_BLACK);
      _display->fillTriangle(x0 + w, topLineY - 2, x0 + w, topLineY + slantDrop, cx, topLineY - 2, SSD1306_BLACK);
    }
  }

  // 5. Happy curved cheek arch accent when squinting happily
  if (_targetExpr == EyeExpression::HAPPY && !_blinking && effTop < 0.3f) {
    _display->fillCircle(cx, y0 + h + 6, w / 2 - 4, SSD1306_BLACK);
  }

  // 6. When nearly closed, draw a crisp sleeping/blinking horizontal lash line
  if (effTop + effBot >= 0.94f) {
    _display->drawFastHLine(x0 + 8, cy, w - 16, SSD1306_WHITE);
    _display->drawFastHLine(x0 + 10, cy + 1, w - 20, SSD1306_WHITE);
  }

  _display->display();
}
