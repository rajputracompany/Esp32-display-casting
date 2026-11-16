package com.minicast.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.minicast.app.bluetooth.DeviceStatus
import com.minicast.app.bluetooth.EyeExpression
import com.minicast.app.settings.MiniCastSettings
import com.minicast.app.ui.theme.ElectricCyan
import com.minicast.app.ui.theme.GraphiteBorder
import com.minicast.app.ui.theme.TextMuted
import com.minicast.app.ui.theme.TextPrimary

@Composable
fun SettingsScreen(
    settings: MiniCastSettings,
    deviceStatus: DeviceStatus,
    onUpdateSettings: ((MiniCastSettings) -> MiniCastSettings) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Settings", color = TextPrimary, fontWeight = FontWeight.Bold)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Advanced Engineering Mode", color = TextPrimary, fontWeight = FontWeight.Medium)
                Text("Expose timing, dithering, and OLED hardware controls", color = TextMuted)
            }
            Switch(
                checked = settings.isAdvancedMode,
                onCheckedChange = { enabled -> onUpdateSettings { it.copy(isAdvancedMode = enabled) } }
            )
        }

        HorizontalDivider(color = GraphiteBorder)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Wake-up Animation", color = TextPrimary, fontWeight = FontWeight.Medium)
                Text("Play cheerful eye opening sequence on wake", color = TextMuted)
            }
            Switch(
                checked = settings.wakeAnimationEnabled,
                onCheckedChange = { enabled -> onUpdateSettings { it.copy(wakeAnimationEnabled = enabled) } }
            )
        }

        Column {
            Text("Auto-Sleep Timeout: ${settings.sleepTimeoutSec}s", color = TextPrimary)
            Slider(
                value = settings.sleepTimeoutSec.toFloat(),
                onValueChange = { v -> onUpdateSettings { it.copy(sleepTimeoutSec = v.toInt()) } },
                valueRange = 10f..180f
            )
        }

        if (settings.isAdvancedMode) {
            Column {
                Text("Custom Display Return Timeout: ${settings.customDisplayTimeoutSec}s", color = TextPrimary)
                Slider(
                    value = settings.customDisplayTimeoutSec.toFloat(),
                    onValueChange = { v -> onUpdateSettings { it.copy(customDisplayTimeoutSec = v.toInt()) } },
                    valueRange = 5f..120f
                )
            }

            Column {
                Text("OLED Brightness / Contrast (0x81): ${settings.displayContrast}/255", color = TextPrimary)
                Slider(
                    value = settings.displayContrast.toFloat(),
                    onValueChange = { v -> onUpdateSettings { it.copy(displayContrast = v.toInt()) } },
                    valueRange = 10f..255f
                )
            }

            Column {
                Text("Default Eye Expression", color = TextPrimary)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(EyeExpression.NEUTRAL, EyeExpression.HAPPY, EyeExpression.CURIOUS).forEach { expr ->
                        OutlinedButton(
                            onClick = { onUpdateSettings { it.copy(defaultExpression = expr) } },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                expr.label,
                                color = if (settings.defaultExpression == expr) ElectricCyan else TextPrimary
                            )
                        }
                    }
                }
            }
        }

        HorizontalDivider(color = GraphiteBorder)

        Text("About ESP32 MiniCast", color = TextPrimary, fontWeight = FontWeight.SemiBold)
        Text("Device Name: ${settings.deviceName}", color = TextMuted)
        Text("Firmware Version: v${deviceStatus.firmwareVersion}", color = TextMuted)
        Text("Hardware Target: ESP32-WROOM-32 · SSD1306 128x64 I2C (GPIO 21/22)", color = TextMuted)
    }
}
