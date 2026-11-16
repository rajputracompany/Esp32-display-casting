package com.minicast.app.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.dp
import com.minicast.app.bluetooth.EyeExpression
import com.minicast.app.ui.theme.ElectricCyan
import com.minicast.app.ui.theme.GraphiteBorder

@Composable
fun OledEyePreview(
    expression: EyeExpression,
    gazeX: Float = 0f,
    isSleeping: Boolean = false,
    modifier: Modifier = Modifier
) {
    val topLidTarget = when {
        isSleeping -> 0.94f
        expression == EyeExpression.SLEEPY -> 0.56f
        expression == EyeExpression.SAD -> 0.22f
        expression == EyeExpression.ANGRY -> 0.24f
        else -> 0.04f
    }
    val bottomLidTarget = when {
        isSleeping -> 0.1f
        expression == EyeExpression.HAPPY -> 0.44f
        expression == EyeExpression.EXCITED -> 0.28f
        else -> 0.02f
    }
    val heightScaleTarget = when (expression) {
        EyeExpression.SURPRISED -> 1.18f
        EyeExpression.EXCITED -> 1.10f
        EyeExpression.SLEEPY -> 0.80f
        else -> 1.0f
    }

    val topLid by animateFloatAsState(topLidTarget, tween(280), label = "topLid")
    val bottomLid by animateFloatAsState(bottomLidTarget, tween(280), label = "bottomLid")
    val heightScale by animateFloatAsState(heightScaleTarget, tween(280), label = "heightScale")
    val animGaze by animateFloatAsState(gazeX, tween(220), label = "gaze")

    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(2f) // Exact 128:64 SSD1306 ratio
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF04060A))
            .border(1.dp, GraphiteBorder, RoundedCornerShape(16.dp))
            .padding(12.dp)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = size.width / 2f + animGaze * size.width * 0.06f
            val cy = size.height / 2f
            val eyeW = size.width * 0.54f
            val eyeH = size.height * 0.68f * heightScale
            val x0 = cx - eyeW / 2f
            val y0 = cy - eyeH / 2f
            val radius = eyeH * 0.36f

            drawRoundRect(
                color = ElectricCyan,
                topLeft = Offset(x0, y0),
                size = Size(eyeW, eyeH),
                cornerRadius = CornerRadius(radius, radius)
            )

            // Pupil
            val pupilRadius = when (expression) {
                EyeExpression.SURPRISED -> eyeH * 0.13f
                EyeExpression.EXCITED -> eyeH * 0.24f
                else -> eyeH * 0.20f
            }
            val px = cx + animGaze * eyeW * 0.16f
            drawCircle(
                color = Color(0xFF04060A),
                radius = pupilRadius,
                center = Offset(px, cy)
            )
            drawCircle(
                color = Color(0xFFE0F7FA),
                radius = pupilRadius * 0.32f,
                center = Offset(px - pupilRadius * 0.3f, cy - pupilRadius * 0.3f)
            )

            // Eyelids
            if (topLid > 0f) {
                drawRect(
                    color = Color(0xFF04060A),
                    topLeft = Offset(x0 - 4f, y0 - 4f),
                    size = Size(eyeW + 8f, eyeH * topLid + 4f)
                )
            }
            if (bottomLid > 0f) {
                val bh = eyeH * bottomLid
                drawRect(
                    color = Color(0xFF04060A),
                    topLeft = Offset(x0 - 4f, y0 + eyeH - bh),
                    size = Size(eyeW + 8f, bh + 4f)
                )
            }

            // Angry or Sad brow slant
            if (expression == EyeExpression.ANGRY) {
                val path = Path().apply {
                    moveTo(x0, y0 + eyeH * topLid)
                    lineTo(cx, y0 + eyeH * (topLid + 0.26f))
                    lineTo(x0 + eyeW, y0 + eyeH * topLid)
                    close()
                }
                drawPath(path, Color(0xFF04060A))
            } else if (expression == EyeExpression.SAD) {
                val leftBrow = Path().apply {
                    moveTo(x0, y0 + eyeH * topLid)
                    lineTo(x0, y0 + eyeH * (topLid + 0.28f))
                    lineTo(cx, y0 + eyeH * topLid)
                    close()
                }
                val rightBrow = Path().apply {
                    moveTo(x0 + eyeW, y0 + eyeH * topLid)
                    lineTo(x0 + eyeW, y0 + eyeH * (topLid + 0.28f))
                    lineTo(cx, y0 + eyeH * topLid)
                    close()
                }
                drawPath(leftBrow, Color(0xFF04060A))
                drawPath(rightBrow, Color(0xFF04060A))
            }

            if (isSleeping) {
                drawLine(
                    color = ElectricCyan,
                    start = Offset(x0 + 16f, cy),
                    end = Offset(x0 + eyeW - 16f, cy),
                    strokeWidth = 5f
                )
            }
        }
    }
}
