package com.minicast.app.display

import android.graphics.Bitmap
import android.graphics.Color
import com.minicast.app.bluetooth.BluetoothProtocol
import kotlin.math.roundToInt

data class MonochromeConversionResult(
    val packedBytes: ByteArray, // 1024 bytes (MSB first, horizontal 128x64 for Adafruit_SSD1306 drawBitmap)
    val previewBitmap: Bitmap
)

object ImageConverter {
    /**
     * Converts any Android Bitmap into a 128x64 1-bit monochrome buffer compatible
     * with Adafruit_SSD1306::drawBitmap(0, 0, buf, 128, 64, SSD1306_WHITE).
     */
    fun convertToOled1Bit(
        source: Bitmap,
        threshold: Int = 128,
        contrast: Float = 1.0f,
        invert: Boolean = false,
        dither: Boolean = true
    ): MonochromeConversionResult {
        val scaled = Bitmap.createScaledBitmap(
            source,
            BluetoothProtocol.OLED_WIDTH,
            BluetoothProtocol.OLED_HEIGHT,
            true
        )

        val w = BluetoothProtocol.OLED_WIDTH
        val h = BluetoothProtocol.OLED_HEIGHT
        val gray = FloatArray(w * h)

        for (y in 0 until h) {
            for (x in 0 until w) {
                val px = scaled.getPixel(x, y)
                val lum = 0.299f * Color.red(px) + 0.587f * Color.green(px) + 0.114f * Color.blue(px)
                val adjusted = ((lum - 128f) * contrast + 128f).coerceIn(0f, 255f)
                gray[y * w + x] = if (invert) 255f - adjusted else adjusted
            }
        }

        val outBytes = ByteArray(BluetoothProtocol.FRAME_BYTES)
        val preview = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)

        for (y in 0 until h) {
            for (x in 0 until w) {
                val idx = y * w + x
                val oldVal = gray[idx]
                val isWhite = oldVal >= threshold
                val newVal = if (isWhite) 255f else 0f

                if (dither) {
                    val err = oldVal - newVal
                    if (x + 1 < w) gray[idx + 1] += err * (7f / 16f)
                    if (y + 1 < h) {
                        if (x > 0) gray[idx + w - 1] += err * (3f / 16f)
                        gray[idx + w] += err * (5f / 16f)
                        if (x + 1 < w) gray[idx + w + 1] += err * (1f / 16f)
                    }
                }

                if (isWhite) {
                    val byteIndex = y * (w / 8) + (x / 8)
                    val bitMask = 0x80 ushr (x % 8)
                    outBytes[byteIndex] = (outBytes[byteIndex].toInt() or bitMask).toByte()
                    preview.setPixel(x, y, Color.rgb(34, 211, 238)) // Electric cyan OLED phosphor preview
                } else {
                    preview.setPixel(x, y, Color.rgb(11, 14, 20))
                }
            }
        }

        return MonochromeConversionResult(outBytes, preview)
    }

    fun packBooleanGrid(grid: BooleanArray): ByteArray {
        val w = BluetoothProtocol.OLED_WIDTH
        val h = BluetoothProtocol.OLED_HEIGHT
        val out = ByteArray(BluetoothProtocol.FRAME_BYTES)
        for (y in 0 until h) {
            for (x in 0 until w) {
                if (grid[y * w + x]) {
                    val byteIndex = y * (w / 8) + (x / 8)
                    val bitMask = 0x80 ushr (x % 8)
                    out[byteIndex] = (out[byteIndex].toInt() or bitMask).toByte()
                }
            }
        }
        return out
    }
}
