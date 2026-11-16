package com.minicast.app.eye

import com.minicast.app.bluetooth.BluetoothProtocol
import com.minicast.app.bluetooth.BluetoothService
import com.minicast.app.bluetooth.EyeExpression
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class EyeController(
    private val btService: BluetoothService
) {
    private val _selectedExpression = MutableStateFlow(EyeExpression.NEUTRAL)
    val selectedExpression: StateFlow<EyeExpression> = _selectedExpression.asStateFlow()

    private val _gazeDirection = MutableStateFlow(0f) // -1 left, 0 center, +1 right
    val gazeDirection: StateFlow<Float> = _gazeDirection.asStateFlow()

    suspend fun selectExpression(expression: EyeExpression): Boolean {
        _selectedExpression.value = expression
        return btService.sendCommand(BluetoothProtocol.cmdEyeExpression(expression))
    }

    suspend fun triggerBlink(): Boolean = btService.sendCommand(BluetoothProtocol.cmdEyeBlink())

    suspend fun lookLeft(): Boolean {
        _gazeDirection.value = -0.9f
        return btService.sendCommand(BluetoothProtocol.cmdLookLeft())
    }

    suspend fun lookRight(): Boolean {
        _gazeDirection.value = 0.9f
        return btService.sendCommand(BluetoothProtocol.cmdLookRight())
    }

    suspend fun lookCenter(): Boolean {
        _gazeDirection.value = 0f
        return btService.sendCommand(BluetoothProtocol.cmdLookCenter())
    }

    suspend fun activateSleep(): Boolean = btService.sendCommand(BluetoothProtocol.cmdEyeSleep())
    suspend fun wakeUp(): Boolean = btService.sendCommand(BluetoothProtocol.cmdEyeWake())
    suspend fun enableIdle(): Boolean = btService.sendCommand(BluetoothProtocol.cmdEyeIdle())

    suspend fun setAnimationSpeed(speed1to10: Int): Boolean =
        btService.sendCommand(BluetoothProtocol.cmdConfig("SPEED", speed1to10.coerceIn(1, 10).toString()))

    suspend fun setSleepTimeoutSeconds(seconds: Int): Boolean =
        btService.sendCommand(BluetoothProtocol.cmdConfig("SLEEP_MS", (seconds * 1000).toString()))
}
