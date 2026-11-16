package com.minicast.app

import com.minicast.app.bluetooth.BluetoothProtocol
import com.minicast.app.bluetooth.EyeExpression
import com.minicast.app.bluetooth.TextAlignment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class BluetoothProtocolTest {

    @Test
    fun textCommandSanitizesDelimiters() {
        val cmd = BluetoothProtocol.cmdText("Hello|World\nLine2", TextAlignment.CENTER)
        assertEquals("TEXT|CENTER|Hello World Line2", cmd)
    }

    @Test
    fun eyeCommandsMatchFirmwareContract() {
        assertEquals("EYE|HAPPY", BluetoothProtocol.cmdEyeExpression(EyeExpression.HAPPY))
        assertEquals("EYE|SLEEP", BluetoothProtocol.cmdEyeSleep())
        assertEquals("EYE|WAKE", BluetoothProtocol.cmdEyeWake())
        assertEquals("EYE|LOOK_LEFT", BluetoothProtocol.cmdLookLeft())
        assertEquals("EYE|LOOK_RIGHT", BluetoothProtocol.cmdLookRight())
    }

    @Test
    fun parseStatusExtractsFirmwareTelemetry() {
        val status = BluetoothProtocol.parseStatus(
            "STATUS|STATE=IDLE_EYE|EXPR=CURIOUS|MODE=EYE|BATT=84|VOLT=3980|FW=1.2.0|UPTIME=142"
        )
        assertNotNull(status)
        assertEquals("IDLE_EYE", status?.state)
        assertEquals(EyeExpression.CURIOUS, status?.expression)
        assertEquals(84, status?.batteryPercent)
        assertEquals("1.2.0", status?.firmwareVersion)
    }

    @Test
    fun xorAndCrc32RemainDeterministic() {
        val payload = ByteArray(64) { (it * 3).toByte() }
        val xor = BluetoothProtocol.xorChecksum(payload)
        val crc = BluetoothProtocol.crc32Hex(payload)
        assertEquals(8, crc.length)
        assertEquals(xor, BluetoothProtocol.xorChecksum(payload))
    }
}
