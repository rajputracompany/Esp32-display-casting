package com.minicast.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.minicast.app.bluetooth.ConnectionState
import com.minicast.app.bluetooth.DeviceStatus
import com.minicast.app.bluetooth.EyeExpression
import com.minicast.app.bluetooth.MiniCastDevice
import com.minicast.app.ui.components.OnboardingSheet
import com.minicast.app.ui.components.OledEyePreview
import com.minicast.app.ui.theme.ElectricCyan
import com.minicast.app.ui.theme.GraphiteBorder
import com.minicast.app.ui.theme.GraphiteSurface
import com.minicast.app.ui.theme.StatusGreen
import com.minicast.app.ui.theme.TextMuted
import com.minicast.app.ui.theme.TextPrimary

@Composable
fun HomeScreen(
    connectionState: ConnectionState,
    deviceStatus: DeviceStatus,
    pairedDevices: List<MiniCastDevice>,
    selectedExpression: EyeExpression,
    onRefreshDevices: () -> Unit,
    onConnect: (MiniCastDevice) -> Unit,
    onDisconnect: () -> Unit,
    onQuickBlink: () -> Unit,
    onQuickHappy: () -> Unit,
    onQuickSleep: () -> Unit,
    onQuickWake: () -> Unit
) {
    var showOnboarding by remember { mutableStateOf(false) }

    if (showOnboarding) {
        OnboardingSheet(onDismiss = { showOnboarding = false })
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("ESP32 MiniCast", color = TextPrimary, fontWeight = FontWeight.Bold)
                    Text("Robotic Eye & Wireless OLED", color = TextMuted)
                }
                TextButton(onClick = { showOnboarding = true }) {
                    Text("Setup Guide", color = ElectricCyan)
                }
            }
        }

        item {
            OledEyePreview(
                expression = selectedExpression,
                isSleeping = deviceStatus.state == "LOW_POWER_SLEEP"
            )
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = GraphiteSurface),
                border = BorderStroke(1.dp, GraphiteBorder),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val statusLabel = when (connectionState) {
                        is ConnectionState.Connected -> "Connected · ${connectionState.device.name}"
                        is ConnectionState.Connecting -> "Connecting to ${connectionState.deviceName}..."
                        is ConnectionState.Error -> "Error · ${connectionState.message}"
                        ConnectionState.Disconnected -> "Not Connected"
                    }
                    Text(
                        statusLabel,
                        color = if (connectionState is ConnectionState.Connected) StatusGreen else TextPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        "Mode: ${deviceStatus.mode} · Battery: ${deviceStatus.batteryPercent}% · State: ${deviceStatus.state}",
                        color = TextMuted
                    )
                    Spacer(Modifier.height(4.dp))
                    if (connectionState is ConnectionState.Connected) {
                        OutlinedButton(onClick = onDisconnect, modifier = Modifier.fillMaxWidth()) {
                            Text("Disconnect")
                        }
                    } else {
                        Button(onClick = onRefreshDevices, modifier = Modifier.fillMaxWidth()) {
                            Text("Scan Paired Bluetooth Devices")
                        }
                    }
                }
            }
        }

        if (connectionState !is ConnectionState.Connected && pairedDevices.isNotEmpty()) {
            item {
                Text("Select Your MiniCast Device", color = TextMuted, fontWeight = FontWeight.Medium)
            }
            items(pairedDevices) { device ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onConnect(device) },
                    colors = CardDefaults.cardColors(containerColor = GraphiteSurface),
                    border = BorderStroke(
                        1.dp,
                        if (device.isMiniCastMatch) ElectricCyan else GraphiteBorder
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(device.name, color = TextPrimary, fontWeight = FontWeight.Medium)
                            Text(device.address, color = TextMuted)
                        }
                        Text("Connect", color = ElectricCyan, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        item {
            Text("Quick Actions", color = TextMuted, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onQuickBlink, modifier = Modifier.weight(1f)) { Text("Blink") }
                OutlinedButton(onClick = onQuickHappy, modifier = Modifier.weight(1f)) { Text("Happy") }
            }
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onQuickWake, modifier = Modifier.weight(1f)) { Text("Wake Up") }
                OutlinedButton(onClick = onQuickSleep, modifier = Modifier.weight(1f)) { Text("Sleep") }
            }
        }
    }
}
