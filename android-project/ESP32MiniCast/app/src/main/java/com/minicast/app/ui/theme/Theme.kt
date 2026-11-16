package com.minicast.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val GraphiteBackground = Color(0xFF0B0E14)
val GraphiteSurface = Color(0xFF12161F)
val GraphiteSurfaceElevated = Color(0xFF171C28)
val GraphiteBorder = Color(0xFF232A3B)
val ElectricCyan = Color(0xFF22D3EE)
val ElectricCyanDim = Color(0xFF0891B2)
val TextPrimary = Color(0xFFF1F5F9)
val TextMuted = Color(0xFF94A3B8)
val StatusGreen = Color(0xFF10B981)
val StatusAmber = Color(0xFFF59E0B)
val StatusCrimson = Color(0xFFEF4444)

private val MiniCastDarkScheme = darkColorScheme(
    primary = ElectricCyan,
    onPrimary = Color(0xFF042F38),
    secondary = ElectricCyanDim,
    onSecondary = TextPrimary,
    background = GraphiteBackground,
    onBackground = TextPrimary,
    surface = GraphiteSurface,
    onSurface = TextPrimary,
    surfaceVariant = GraphiteSurfaceElevated,
    onSurfaceVariant = TextMuted,
    outline = GraphiteBorder,
    error = StatusCrimson
)

private val MiniCastTypography = Typography(
    headlineMedium = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.3).sp),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium)
)

@Composable
fun MiniCastTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MiniCastDarkScheme,
        typography = MiniCastTypography,
        content = content
    )
}
