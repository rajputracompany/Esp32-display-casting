package com.minicast.app.ui.screens

import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.minicast.app.bluetooth.BluetoothProtocol
import com.minicast.app.bluetooth.BuiltinAnimation
import com.minicast.app.bluetooth.TextAlignment
import com.minicast.app.display.ImageConverter
import com.minicast.app.display.TransferState
import com.minicast.app.ui.theme.ElectricCyan
import com.minicast.app.ui.theme.GraphiteBorder
import com.minicast.app.ui.theme.GraphiteSurface
import com.minicast.app.ui.theme.TextMuted
import com.minicast.app.ui.theme.TextPrimary

@Composable
fun DisplayStudioScreen(
    isAdvancedMode: Boolean,
    transferState: TransferState,
    onSendStaticText: (String, TextAlignment) -> Unit,
    onSendScrollText: (String) -> Unit,
    onClearScreen: () -> Unit,
    onSendBitmap: (ByteArray) -> Unit,
    onStartAnimation: (BuiltinAnimation) -> Unit,
    onStopAnimation: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Text", "Image", "Pixel Art", "Animate")

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = selectedTab, containerColor = GraphiteSurface) {
            tabs.forEachIndexed { idx, title ->
                Tab(
                    selected = selectedTab == idx,
                    onClick = { selectedTab = idx },
                    text = { Text(title) }
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            when (selectedTab) {
                0 -> TextStudioTab(onSendStaticText, onSendScrollText, onClearScreen)
                1 -> ImageStudioTab(isAdvancedMode, transferState, onSendBitmap)
                2 -> PixelArtStudioTab(transferState, onSendBitmap)
                3 -> AnimationStudioTab(onStartAnimation, onStopAnimation)
            }
        }
    }
}

@Composable
private fun TextStudioTab(
    onSendStaticText: (String, TextAlignment) -> Unit,
    onSendScrollText: (String) -> Unit,
    onClearScreen: () -> Unit
) {
    var text by remember { mutableStateOf("Hello MiniCast!") }
    var alignment by remember { mutableStateOf(TextAlignment.CENTER) }
    var scrolling by remember { mutableStateOf(false) }

    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        label = { Text("OLED Message") },
        modifier = Modifier.fillMaxWidth()
    )

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TextAlignment.entries.forEach { align ->
            OutlinedButton(
                onClick = { alignment = align },
                modifier = Modifier.weight(1f)
            ) {
                Text(align.label, color = if (alignment == align) ElectricCyan else TextPrimary)
            }
        }
    }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        Text("Scrolling Marquee", color = TextPrimary)
        Switch(checked = scrolling, onCheckedChange = { scrolling = it })
    }

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = { if (scrolling) onSendScrollText(text) else onSendStaticText(text, alignment) },
            modifier = Modifier.weight(1f)
        ) { Text("Send to MiniCast") }
        OutlinedButton(onClick = onClearScreen) { Text("Clear") }
    }
}

@Composable
private fun ImageStudioTab(
    isAdvancedMode: Boolean,
    transferState: TransferState,
    onSendBitmap: (ByteArray) -> Unit
) {
    val context = LocalContext.current
    var sourceBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var threshold by remember { mutableIntStateOf(128) }
    var contrast by remember { mutableStateOf(1.1f) }
    var dither by remember { mutableStateOf(true) }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            sourceBitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, it)) { decoder, _, _ ->
                    decoder.isMutableRequired = true
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                }
            } else {
                @Suppress("DEPRECATION")
                MediaStore.Images.Media.getBitmap(context.contentResolver, it)
            }
        }
    }

    Button(onClick = { launcher.launch("image/*") }, modifier = Modifier.fillMaxWidth()) {
        Text("Import Image from Gallery")
    }

    sourceBitmap?.let { bmp ->
        val converted = remember(bmp, threshold, contrast, dither) {
            ImageConverter.convertToOled1Bit(bmp, threshold = threshold, contrast = contrast, dither = dither)
        }
        Image(
            bitmap = converted.previewBitmap.asImageBitmap(),
            contentDescription = "128x64 OLED Preview",
            contentScale = ContentScale.FillBounds,
            filterQuality = FilterQuality.None,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f)
                .border(1.dp, GraphiteBorder, RoundedCornerShape(12.dp))
        )

        if (isAdvancedMode) {
            Text("Threshold ($threshold)", color = TextMuted)
            Slider(value = threshold.toFloat(), onValueChange = { threshold = it.toInt() }, valueRange = 20f..235f)
            Text("Contrast (${"%.1f".format(contrast)}x)", color = TextMuted)
            Slider(value = contrast, onValueChange = { contrast = it }, valueRange = 0.5f..2.5f)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Floyd-Steinberg Dithering", color = TextPrimary)
                Switch(checked = dither, onCheckedChange = { dither = it })
            }
        }

        if (transferState is TransferState.Sending) {
            LinearProgressIndicator(progress = { transferState.progress }, modifier = Modifier.fillMaxWidth())
            Text("Sending chunk ${transferState.chunkIndex}/${transferState.totalChunks}", color = TextMuted)
        } else if (transferState is TransferState.Failed) {
            Text("Error: ${transferState.reason}", color = Color.Red)
        }

        Button(
            onClick = { onSendBitmap(converted.packedBytes) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Cast Image to OLED") }
    }
}

@Composable
private fun PixelArtStudioTab(
    transferState: TransferState,
    onSendBitmap: (ByteArray) -> Unit
) {
    val w = BluetoothProtocol.OLED_WIDTH
    val h = BluetoothProtocol.OLED_HEIGHT
    var grid by remember { mutableStateOf(BooleanArray(w * h)) }
    var eraseMode by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(2f)
            .background(Color(0xFF04060A), RoundedCornerShape(12.dp))
            .border(1.dp, GraphiteBorder, RoundedCornerShape(12.dp))
            .pointerInput(eraseMode) {
                detectTapGestures { offset ->
                    val px = ((offset.x / size.width) * w).toInt().coerceIn(0, w - 1)
                    val py = ((offset.y / size.height) * h).toInt().coerceIn(0, h - 1)
                    val next = grid.copyOf()
                    next[py * w + px] = !eraseMode
                    grid = next
                }
            }
            .pointerInput(eraseMode) {
                detectDragGestures { change, _ ->
                    val px = ((change.position.x / size.width) * w).toInt().coerceIn(0, w - 1)
                    val py = ((change.position.y / size.height) * h).toInt().coerceIn(0, h - 1)
                    val next = grid.copyOf()
                    next[py * w + px] = !eraseMode
                    grid = next
                }
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cellW = size.width / w
            val cellH = size.height / h
            for (y in 0 until h) {
                for (x in 0 until w) {
                    if (grid[y * w + x]) {
                        drawRect(
                            color = ElectricCyan,
                            topLeft = Offset(x * cellW, y * cellH),
                            size = Size(cellW + 0.5f, cellH + 0.5f)
                        )
                    }
                }
            }
        }
    }

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { eraseMode = !eraseMode }, modifier = Modifier.weight(1f)) {
            Text(if (eraseMode) "Mode: Erase" else "Mode: Draw")
        }
        OutlinedButton(onClick = { grid = BooleanArray(w * h) }, modifier = Modifier.weight(1f)) {
            Text("Clear Canvas")
        }
    }

    if (transferState is TransferState.Sending) {
        LinearProgressIndicator(progress = { transferState.progress }, modifier = Modifier.fillMaxWidth())
    }

    Button(
        onClick = { onSendBitmap(ImageConverter.packBooleanGrid(grid)) },
        modifier = Modifier.fillMaxWidth()
    ) { Text("Send Artwork to MiniCast") }
}

@Composable
private fun AnimationStudioTab(
    onStartAnimation: (BuiltinAnimation) -> Unit,
    onStopAnimation: () -> Unit
) {
    BuiltinAnimation.entries.forEach { anim ->
        OutlinedButton(
            onClick = { onStartAnimation(anim) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Play ${anim.label}") }
    }
    Spacer(Modifier.height(4.dp))
    Button(onClick = onStopAnimation, modifier = Modifier.fillMaxWidth()) {
        Text("Return to Robotic Eye")
    }
}
