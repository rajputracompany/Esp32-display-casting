package com.minicast.app.display

import com.minicast.app.bluetooth.BluetoothProtocol
import com.minicast.app.bluetooth.BluetoothService
import com.minicast.app.bluetooth.BuiltinAnimation
import com.minicast.app.bluetooth.TextAlignment

class DisplayController(
    private val btService: BluetoothService,
    val bitmapTransfer: BitmapTransfer
) {
    suspend fun sendStaticText(text: String, alignment: TextAlignment): Boolean =
        btService.sendCommand(BluetoothProtocol.cmdText(text, alignment))

    suspend fun sendScrollingText(text: String, speed: Int): Boolean =
        btService.sendCommand(BluetoothProtocol.cmdScroll(text, speed))

    suspend fun clearScreen(): Boolean =
        btService.sendCommand(BluetoothProtocol.cmdClear())

    suspend fun startAnimation(animation: BuiltinAnimation): Boolean =
        btService.sendCommand(BluetoothProtocol.cmdAnim(animation))

    suspend fun stopAnimation(): Boolean =
        btService.sendCommand(BluetoothProtocol.cmdAnimStop())

    suspend fun sendPackedBitmap(bytes: ByteArray): Boolean =
        bitmapTransfer.transmitFrame(bytes)
}
