package com.minicast.app.settings

import android.content.Context
import com.minicast.app.bluetooth.BluetoothProtocol
import com.minicast.app.bluetooth.BluetoothService
import com.minicast.app.bluetooth.EyeExpression
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class MiniCastSettings(
    val deviceName: String = "ESP32-MiniCast",
    val isAdvancedMode: Boolean = false,
    val sleepTimeoutSec: Int = 45,
    val customDisplayTimeoutSec: Int = 20,
    val wakeAnimationEnabled: Boolean = true,
    val defaultExpression: EyeExpression = EyeExpression.NEUTRAL,
    val animationSpeed: Int = 6,
    val displayContrast: Int = 200,
    val scrollSpeed: Int = 3,
    val defaultMode: String = "EYE"
)

class SettingsManager(
    context: Context,
    private val btService: BluetoothService
) {
    private val prefs = context.getSharedPreferences("minicast_prefs", Context.MODE_PRIVATE)
    private val _settings = MutableStateFlow(load())
    val settings: StateFlow<MiniCastSettings> = _settings.asStateFlow()

    private fun load(): MiniCastSettings {
        val exprName = prefs.getString("default_expr", "NEUTRAL") ?: "NEUTRAL"
        val expr = EyeExpression.entries.find { it.wireName == exprName } ?: EyeExpression.NEUTRAL
        return MiniCastSettings(
            deviceName = prefs.getString("device_name", "ESP32-MiniCast") ?: "ESP32-MiniCast",
            isAdvancedMode = prefs.getBoolean("advanced_mode", false),
            sleepTimeoutSec = prefs.getInt("sleep_timeout", 45),
            customDisplayTimeoutSec = prefs.getInt("display_timeout", 20),
            wakeAnimationEnabled = prefs.getBoolean("wake_anim", true),
            defaultExpression = expr,
            animationSpeed = prefs.getInt("anim_speed", 6),
            displayContrast = prefs.getInt("contrast", 200),
            scrollSpeed = prefs.getInt("scroll_speed", 3),
            defaultMode = prefs.getString("default_mode", "EYE") ?: "EYE"
        )
    }

    suspend fun updateAndSync(transform: (MiniCastSettings) -> MiniCastSettings) {
        val next = transform(_settings.value)
        _settings.value = next
        prefs.edit()
            .putString("device_name", next.deviceName)
            .putBoolean("advanced_mode", next.isAdvancedMode)
            .putInt("sleep_timeout", next.sleepTimeoutSec)
            .putInt("display_timeout", next.customDisplayTimeoutSec)
            .putBoolean("wake_anim", next.wakeAnimationEnabled)
            .putString("default_expr", next.defaultExpression.wireName)
            .putInt("anim_speed", next.animationSpeed)
            .putInt("contrast", next.displayContrast)
            .putInt("scroll_speed", next.scrollSpeed)
            .putString("default_mode", next.defaultMode)
            .apply()

        btService.sendCommand(BluetoothProtocol.cmdConfig("SLEEP_MS", (next.sleepTimeoutSec * 1000).toString()))
        btService.sendCommand(BluetoothProtocol.cmdConfig("DISPLAY_MS", (next.customDisplayTimeoutSec * 1000).toString()))
        btService.sendCommand(BluetoothProtocol.cmdConfig("SPEED", next.animationSpeed.toString()))
        btService.sendCommand(BluetoothProtocol.cmdConfig("CONTRAST", next.displayContrast.toString()))
        btService.sendCommand(BluetoothProtocol.cmdConfig("WAKE_ANIM", if (next.wakeAnimationEnabled) "1" else "0"))
        btService.sendCommand(BluetoothProtocol.cmdConfig("DEFAULT_EXPR", next.defaultExpression.wireName))
    }
}
