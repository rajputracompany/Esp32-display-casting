package com.minicast.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.minicast.app.ui.theme.ElectricCyan
import com.minicast.app.ui.theme.GraphiteSurface
import com.minicast.app.ui.theme.TextMuted
import com.minicast.app.ui.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingSheet(onDismiss: () -> Unit) {
    val steps = listOf(
        "1. Turn on MiniCast" to "Power your ESP32 DevKit V1 via USB or the 18650 battery pack. The OLED eye wakes automatically.",
        "2. Enable Bluetooth" to "Turn on Bluetooth in Android Settings and pair with 'ESP32-MiniCast' once.",
        "3. Select the MiniCast device" to "Tap Connect on the Home screen and choose your paired ESP32-MiniCast.",
        "4. Connect" to "MiniCast opens a dedicated Bluetooth Classic SPP link in the background.",
        "5. Control the eye or display" to "Switch robotic eye emotions or cast text, photos, and pixel art to the OLED."
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = GraphiteSurface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("Getting Started with MiniCast", color = TextPrimary, fontWeight = FontWeight.SemiBold)
            steps.forEach { (title, body) ->
                Row(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(title, color = ElectricCyan, fontWeight = FontWeight.Medium)
                        Text(body, color = TextMuted)
                    }
                }
            }
            Button(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 16.dp)
            ) {
                Text("Got It")
            }
        }
    }
}
