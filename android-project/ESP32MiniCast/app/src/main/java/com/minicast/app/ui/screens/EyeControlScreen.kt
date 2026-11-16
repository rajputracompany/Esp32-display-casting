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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.minicast.app.bluetooth.EyeExpression
import com.minicast.app.eye.ExpressionMeta
import com.minicast.app.ui.components.OledEyePreview
import com.minicast.app.ui.theme.ElectricCyan
import com.minicast.app.ui.theme.GraphiteBorder
import com.minicast.app.ui.theme.GraphiteSurface
import com.minicast.app.ui.theme.TextMuted
import com.minicast.app.ui.theme.TextPrimary

@Composable
fun EyeControlScreen(
    expressions: List<ExpressionMeta>,
    selectedExpression: EyeExpression,
    gazeDirection: Float,
    isAdvancedMode: Boolean,
    animationSpeed: Int,
    sleepTimeoutSec: Int,
    onSelectExpression: (EyeExpression) -> Unit,
    onBlink: () -> Unit,
    onLookLeft: () -> Unit,
    onLookCenter: () -> Unit,
    onLookRight: () -> Unit,
    onSleep: () -> Unit,
    onWake: () -> Unit,
    onIdle: () -> Unit,
    onSpeedChange: (Int) -> Unit,
    onSleepTimeoutChange: (Int) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OledEyePreview(expression = selectedExpression, gazeX = gazeDirection)

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onLookLeft, modifier = Modifier.weight(1f)) { Text("Left") }
            OutlinedButton(onClick = onLookCenter, modifier = Modifier.weight(1f)) { Text("Center") }
            OutlinedButton(onClick = onLookRight, modifier = Modifier.weight(1f)) { Text("Right") }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onBlink, modifier = Modifier.weight(1f)) { Text("Blink") }
            OutlinedButton(onClick = onWake, modifier = Modifier.weight(1f)) { Text("Wake") }
            OutlinedButton(onClick = onSleep, modifier = Modifier.weight(1f)) { Text("Sleep") }
            OutlinedButton(onClick = onIdle, modifier = Modifier.weight(1f)) { Text("Idle") }
        }

        if (isAdvancedMode) {
            Text("Animation Speed ($animationSpeed/10)", color = TextMuted)
            Slider(
                value = animationSpeed.toFloat(),
                onValueChange = { onSpeedChange(it.toInt()) },
                valueRange = 1f..10f
            )
            Text("Sleep Timeout (${sleepTimeoutSec}s)", color = TextMuted)
            Slider(
                value = sleepTimeoutSec.toFloat(),
                onValueChange = { onSleepTimeoutChange(it.toInt()) },
                valueRange = 10f..180f
            )
        }

        Text("Emotional Expressions", color = TextPrimary, fontWeight = FontWeight.SemiBold)

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.weight(1f)
        ) {
            items(expressions) { meta ->
                val isSelected = meta.expression == selectedExpression
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectExpression(meta.expression) },
                    colors = CardDefaults.cardColors(containerColor = GraphiteSurface),
                    border = BorderStroke(1.dp, if (isSelected) ElectricCyan else GraphiteBorder),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            meta.title,
                            color = if (isSelected) ElectricCyan else TextPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(meta.subtitle, color = TextMuted)
                    }
                }
            }
        }
    }
}
