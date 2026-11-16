package com.minicast.app.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothSocket
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStream

class BluetoothService(
    private val btManager: BluetoothManager
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val writeMutex = Mutex()

    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var readerJob: Job? = null
    private var pendingAck: CompletableDeferred<String>? = null

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _deviceStatus = MutableStateFlow(DeviceStatus())
    val deviceStatus: StateFlow<DeviceStatus> = _deviceStatus.asStateFlow()

    private val _incomingLines = MutableSharedFlow<String>(extraBufferCapacity = 32)
    val incomingLines: SharedFlow<String> = _incomingLines.asSharedFlow()

    @SuppressLint("MissingPermission")
    fun connect(device: MiniCastDevice) {
        scope.launch {
            disconnectInternal()
            _connectionState.value = ConnectionState.Connecting(device.name)
            try {
                val remote = btManager.getRemoteDevice(device.address)
                    ?: throw IOException("Device ${device.address} not found")
                val rfcomm = remote.createRfcommSocketToServiceRecord(BluetoothProtocol.SPP_UUID)
                rfcomm.connect()
                socket = rfcomm
                outputStream = rfcomm.outputStream
                _connectionState.value = ConnectionState.Connected(device)
                startReaderLoop(rfcomm)
                delay(150)
                sendCommand(BluetoothProtocol.cmdStatus())
            } catch (e: Exception) {
                disconnectInternal()
                _connectionState.value = ConnectionState.Error(
                    e.message ?: "Could not open SPP connection to ${device.name}"
                )
            }
        }
    }

    fun disconnect() {
        scope.launch {
            disconnectInternal()
            _connectionState.value = ConnectionState.Disconnected
        }
    }

    private fun startReaderLoop(rfcomm: BluetoothSocket) {
        readerJob?.cancel()
        readerJob = scope.launch {
            try {
                val reader = BufferedReader(InputStreamReader(rfcomm.inputStream))
                while (isActive) {
                    val line = reader.readLine() ?: break
                    _incomingLines.tryEmit(line)
                    BluetoothProtocol.parseStatus(line)?.let { _deviceStatus.value = it }
                    pendingAck?.let { deferred ->
                        if (line.startsWith("OK|") || line.startsWith("ACK|") ||
                            line.startsWith("NAK|") || line.startsWith("ERR|")
                        ) {
                            deferred.complete(line)
                        }
                    }
                }
            } catch (_: IOException) {
                // Socket closed or out of range
            } finally {
                if (_connectionState.value is ConnectionState.Connected) {
                    _connectionState.value = ConnectionState.Error("Bluetooth link lost")
                }
            }
        }
    }

    suspend fun sendCommand(command: String): Boolean = withContext(Dispatchers.IO) {
        writeMutex.withLock {
            val out = outputStream ?: return@withContext false
            try {
                out.write((command + "\n").toByteArray(Charsets.UTF_8))
                out.flush()
                true
            } catch (e: IOException) {
                _connectionState.value = ConnectionState.Error("Transmission failed: ${e.message}")
                false
            }
        }
    }

    suspend fun sendAndAwaitAck(command: String, timeoutMs: Long = 1800L): String? =
        withContext(Dispatchers.IO) {
            writeMutex.withLock {
                val out = outputStream ?: return@withContext null
                val waiter = CompletableDeferred<String>()
                pendingAck = waiter
                try {
                    out.write((command + "\n").toByteArray(Charsets.UTF_8))
                    out.flush()
                    withTimeoutOrNull(timeoutMs) { waiter.await() }
                } catch (_: IOException) {
                    null
                } finally {
                    pendingAck = null
                }
            }
        }

    private fun disconnectInternal() {
        readerJob?.cancel()
        readerJob = null
        try {
            outputStream?.close()
            socket?.close()
        } catch (_: IOException) {
        } finally {
            outputStream = null
            socket = null
        }
    }
}
