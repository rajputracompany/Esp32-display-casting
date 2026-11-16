package com.minicast.app.bluetooth

import java.util.UUID
import java.util.zip.CRC32

enum class EyeExpression(val wireName: String, val label: String) {
    NEUTRAL("NEUTRAL", "Neutral"),
    HAPPY("HAPPY", "Happy"),
    EXCITED("EXCITED", "Excited"),
    CURIOUS("CURIOUS", "Curious"),
    SLEEPY("SLEEPY", "Sleepy"),
    SURPRISED("SURPRISED", "Surprised"),
    SAD("SAD", "Sad"),
    ANGRY("ANGRY", "Angry")
}

enum class TextAlignment(val wireName: String, val label: String) {
    LEFT("LEFT", "Left"),
    CENTER("CENTER", "Center"),
    RIGHT("RIGHT", "Right")
}

enum class BuiltinAnimation(val wireName: String, val label: String) {
    ORB("ORB", "Orbital Pulse"),
    HEARTBEAT("HEARTBEAT", "Heartbeat ECG"),
    AUDIO_BARS("AUDIO_BARS", "Spectrum Bars"),
    STARFIELD("STARFIELD", "Starfield Warp")
}

data class DeviceStatus(
    val state: String = "IDLE_EYE",
    val expression: EyeExpression = EyeExpression.NEUTRAL,
    val mode: String = "EYE",
    val batteryPercent: Int = 100,
    val batteryMillivolts: Int = 4150,
    val firmwareVersion: String = "1.2.0",
    val uptimeSeconds: Long = 0L
)

object BluetoothProtocol {
    val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    const val OLED_WIDTH = 128
    const val OLED_HEIGHT = 64
    const val FRAME_BYTES = (OLED_WIDTH * OLED_HEIGHT) / 8 // 1024 bytes
    const val CHUNK_SIZE_BYTES = 64 // 16 chunks = 1024 bytes

    fun cmdPing(): String = "PING"
    fun cmdStatus(): String = "STATUS"
    fun cmdClear(): String = "CLEAR"

    fun cmdText(text: String, align: TextAlignment = TextAlignment.CENTER): String {
        val clean = text.replace("|", " ").replace("\n", " ").trim()
        return "TEXT|${align.wireName}|$clean"
    }

    fun cmdScroll(text: String, speed: Int = 3): String {
        val clean = text.replace("|", " ").replace("\n", " ").trim()
        return "SCROLL|${speed.coerceIn(1, 10)}|$clean"
    }

    fun cmdEyeExpression(expr: EyeExpression): String = "EYE|${expr.wireName}"
    fun cmdEyeBlink(): String = "EYE|BLINK"
    fun cmdEyeSleep(): String = "EYE|SLEEP"
    fun cmdEyeWake(): String = "EYE|WAKE"
    fun cmdEyeIdle(): String = "EYE|IDLE"
    fun cmdLookLeft(): String = "EYE|LOOK_LEFT"
    fun cmdLookRight(): String = "EYE|LOOK_RIGHT"
    fun cmdLookCenter(): String = "EYE|LOOK_CENTER"

    fun cmdAnim(anim: BuiltinAnimation): String = "ANIM|${anim.wireName}"
    fun cmdAnimStop(): String = "ANIM|STOP"

    fun cmdConfig(key: String, value: String): String = "CFG|${key.uppercase()}|$value"

    fun cmdImgStart(crc32Hex: String): String =
        "IMG_START|$OLED_WIDTH|$OLED_HEIGHT|$FRAME_BYTES|$CHUNK_SIZE_BYTES|$crc32Hex"

    fun cmdImgData(chunkIndex: Int, chunk: ByteArray): String {
        val hex = chunk.joinToString("") { "%02X".format(it) }
        val xor = xorChecksum(chunk)
        return "IMG_DATA|$chunkIndex|$hex|%02X".format(xor)
    }

    fun cmdImgEnd(crc32Hex: String): String = "IMG_END|$crc32Hex"

    fun crc32Hex(data: ByteArray): String {
        val crc = CRC32()
        crc.update(data)
        return "%08X".format(crc.value)
    }

    fun xorChecksum(data: ByteArray): Int {
        var acc = 0
        for (b in data) acc = acc xor (b.toInt() and 0xFF)
        return acc and 0xFF
    }

    fun parseStatus(line: String): DeviceStatus? {
        if (!line.startsWith("STATUS|")) return null
        val map = mutableMapOf<String, String>()
        line.split("|").drop(1).forEach { pair ->
            val idx = pair.indexOf('=')
            if (idx > 0) {
                map[pair.substring(0, idx)] = pair.substring(idx + 1)
            }
        }
        val expr = EyeExpression.entries.find { it.wireName == map["EXPR"] } ?: EyeExpression.NEUTRAL
        return DeviceStatus(
            state = map["STATE"] ?: "IDLE_EYE",
            expression = expr,
            mode = map["MODE"] ?: "EYE",
            batteryPercent = map["BATT"]?.toIntOrNull() ?: 100,
            batteryMillivolts = map["VOLT"]?.toIntOrNull() ?: 4150,
            firmwareVersion = map["FW"] ?: "1.2.0",
            uptimeSeconds = map["UPTIME"]?.toLongOrNull() ?: 0L
        )
    }
}
