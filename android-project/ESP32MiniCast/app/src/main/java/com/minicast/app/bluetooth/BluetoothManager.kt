package com.minicast.app.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager as AndroidBtManager
import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class MiniCastDevice(
    val name: String,
    val address: String,
    val isMiniCastMatch: Boolean
)

sealed interface ConnectionState {
    data object Disconnected : ConnectionState
    data class Connecting(val deviceName: String) : ConnectionState
    data class Connected(val device: MiniCastDevice) : ConnectionState
    data class Error(val message: String) : ConnectionState
}

class BluetoothManager(context: Context) {
    private val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? AndroidBtManager
    private val adapter: BluetoothAdapter? = btManager?.adapter

    private val _pairedDevices = MutableStateFlow<List<MiniCastDevice>>(emptyList())
    val pairedDevices: StateFlow<List<MiniCastDevice>> = _pairedDevices.asStateFlow()

    fun isBluetoothSupported(): Boolean = adapter != null
    fun isBluetoothEnabled(): Boolean = adapter?.isEnabled == true

    @SuppressLint("MissingPermission")
    fun refreshPairedDevices(): List<MiniCastDevice> {
        val bonded = adapter?.bondedDevices ?: emptySet()
        val list = bonded.map { dev ->
            val label = dev.name ?: "Unnamed Device"
            MiniCastDevice(
                name = label,
                address = dev.address,
                isMiniCastMatch = label.contains("MiniCast", ignoreCase = true) ||
                    label.contains("ESP32", ignoreCase = true)
            )
        }.sortedByDescending { it.isMiniCastMatch }
        _pairedDevices.value = list
        return list
    }

    fun getRemoteDevice(address: String): BluetoothDevice? {
        return try {
            adapter?.getRemoteDevice(address)
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
