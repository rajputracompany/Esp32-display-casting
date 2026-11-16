package com.minicast.app.display

import com.minicast.app.bluetooth.BluetoothProtocol
import com.minicast.app.bluetooth.BluetoothService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface TransferState {
    data object Idle : TransferState
    data class Sending(val progress: Float, val chunkIndex: Int, val totalChunks: Int) : TransferState
    data object Success : TransferState
    data class Failed(val reason: String) : TransferState
}

class BitmapTransfer(
    private val btService: BluetoothService
) {
    private val _transferState = MutableStateFlow<TransferState>(TransferState.Idle)
    val transferState: StateFlow<TransferState> = _transferState.asStateFlow()

    suspend fun transmitFrame(frameBytes: ByteArray): Boolean {
        if (frameBytes.size != BluetoothProtocol.FRAME_BYTES) {
            _transferState.value = TransferState.Failed("Invalid frame size (${frameBytes.size} bytes)")
            return false
        }

        val crcHex = BluetoothProtocol.crc32Hex(frameBytes)
        val startAck = btService.sendAndAwaitAck(BluetoothProtocol.cmdImgStart(crcHex))
        if (startAck == null || !startAck.startsWith("OK|IMG_START")) {
            _transferState.value = TransferState.Failed(startAck ?: "ESP32 did not acknowledge IMG_START")
            return false
        }

        val chunkSize = BluetoothProtocol.CHUNK_SIZE_BYTES
        val totalChunks = frameBytes.size / chunkSize

        for (chunkIndex in 0 until totalChunks) {
            val offset = chunkIndex * chunkSize
            val chunk = frameBytes.copyOfRange(offset, offset + chunkSize)
            val packet = BluetoothProtocol.cmdImgData(chunkIndex, chunk)

            var acknowledged = false
            for (attempt in 1..3) {
                val reply = btService.sendAndAwaitAck(packet)
                if (reply == "ACK|$chunkIndex") {
                    acknowledged = true
                    break
                }
            }
            if (!acknowledged) {
                _transferState.value = TransferState.Failed("Chunk $chunkIndex failed after 3 retries")
                return false
            }

            _transferState.value = TransferState.Sending(
                progress = (chunkIndex + 1).toFloat() / totalChunks,
                chunkIndex = chunkIndex + 1,
                totalChunks = totalChunks
            )
        }

        val endAck = btService.sendAndAwaitAck(BluetoothProtocol.cmdImgEnd(crcHex))
        return if (endAck == "OK|IMG_END") {
            _transferState.value = TransferState.Success
            true
        } else {
            _transferState.value = TransferState.Failed(endAck ?: "CRC verification failed on ESP32")
            false
        }
    }

    fun resetState() {
        _transferState.value = TransferState.Idle
    }
}
