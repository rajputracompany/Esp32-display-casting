package com.minicast.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.RemoveRedEye
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Tv
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.minicast.app.bluetooth.BluetoothManager
import com.minicast.app.bluetooth.BluetoothService
import com.minicast.app.bluetooth.EyeExpression
import com.minicast.app.display.DisplayController
import com.minicast.app.eye.ExpressionManager
import com.minicast.app.eye.EyeController
import com.minicast.app.settings.SettingsManager
import com.minicast.app.ui.screens.DisplayStudioScreen
import com.minicast.app.ui.screens.EyeControlScreen
import com.minicast.app.ui.screens.HomeScreen
import com.minicast.app.ui.screens.SettingsScreen
import com.minicast.app.ui.theme.GraphiteSurface
import kotlinx.coroutines.launch

sealed class Route(val path: String, val label: String) {
    data object Home : Route("home", "Home")
    data object Eye : Route("eye", "Eye")
    data object Studio : Route("studio", "Studio")
    data object Settings : Route("settings", "Settings")
}

@Composable
fun MiniCastNav(
    btManager: BluetoothManager,
    btService: BluetoothService,
    eyeController: EyeController,
    expressionManager: ExpressionManager,
    displayController: DisplayController,
    settingsManager: SettingsManager,
    onRequestBluetoothPermissions: () -> Unit
) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()

    val connectionState by btService.connectionState.collectAsState()
    val deviceStatus by btService.deviceStatus.collectAsState()
    val pairedDevices by btManager.pairedDevices.collectAsState()
    val selectedExpression by eyeController.selectedExpression.collectAsState()
    val gazeDirection by eyeController.gazeDirection.collectAsState()
    val settings by settingsManager.settings.collectAsState()
    val transferState by displayController.bitmapTransfer.transferState.collectAsState()

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val items = listOf(
        Route.Home to Icons.Outlined.Home,
        Route.Eye to Icons.Outlined.RemoveRedEye,
        Route.Studio to Icons.Outlined.Tv,
        Route.Settings to Icons.Outlined.Settings
    )

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = GraphiteSurface) {
                items.forEach { (route, icon) ->
                    NavigationBarItem(
                        selected = currentRoute == route.path,
                        onClick = {
                            navController.navigate(route.path) {
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(icon, contentDescription = route.label) },
                        label = { Text(route.label) }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Route.Home.path,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Route.Home.path) {
                HomeScreen(
                    connectionState = connectionState,
                    deviceStatus = deviceStatus,
                    pairedDevices = pairedDevices,
                    selectedExpression = selectedExpression,
                    onRefreshDevices = {
                        onRequestBluetoothPermissions()
                        btManager.refreshPairedDevices()
                    },
                    onConnect = { btService.connect(it) },
                    onDisconnect = { btService.disconnect() },
                    onQuickBlink = { scope.launch { eyeController.triggerBlink() } },
                    onQuickHappy = { scope.launch { eyeController.selectExpression(EyeExpression.HAPPY) } },
                    onQuickSleep = { scope.launch { eyeController.activateSleep() } },
                    onQuickWake = { scope.launch { eyeController.wakeUp() } }
                )
            }
            composable(Route.Eye.path) {
                EyeControlScreen(
                    expressions = expressionManager.allExpressions,
                    selectedExpression = selectedExpression,
                    gazeDirection = gazeDirection,
                    isAdvancedMode = settings.isAdvancedMode,
                    animationSpeed = settings.animationSpeed,
                    sleepTimeoutSec = settings.sleepTimeoutSec,
                    onSelectExpression = { expr -> scope.launch { eyeController.selectExpression(expr) } },
                    onBlink = { scope.launch { eyeController.triggerBlink() } },
                    onLookLeft = { scope.launch { eyeController.lookLeft() } },
                    onLookCenter = { scope.launch { eyeController.lookCenter() } },
                    onLookRight = { scope.launch { eyeController.lookRight() } },
                    onSleep = { scope.launch { eyeController.activateSleep() } },
                    onWake = { scope.launch { eyeController.wakeUp() } },
                    onIdle = { scope.launch { eyeController.enableIdle() } },
                    onSpeedChange = { speed ->
                        scope.launch {
                            settingsManager.updateAndSync { it.copy(animationSpeed = speed) }
                            eyeController.setAnimationSpeed(speed)
                        }
                    },
                    onSleepTimeoutChange = { sec ->
                        scope.launch {
                            settingsManager.updateAndSync { it.copy(sleepTimeoutSec = sec) }
                            eyeController.setSleepTimeoutSeconds(sec)
                        }
                    }
                )
            }
            composable(Route.Studio.path) {
                DisplayStudioScreen(
                    isAdvancedMode = settings.isAdvancedMode,
                    transferState = transferState,
                    onSendStaticText = { txt, align ->
                        scope.launch { displayController.sendStaticText(txt, align) }
                    },
                    onSendScrollText = { txt ->
                        scope.launch { displayController.sendScrollingText(txt, settings.scrollSpeed) }
                    },
                    onClearScreen = { scope.launch { displayController.clearScreen() } },
                    onSendBitmap = { bytes ->
                        scope.launch { displayController.sendPackedBitmap(bytes) }
                    },
                    onStartAnimation = { anim ->
                        scope.launch { displayController.startAnimation(anim) }
                    },
                    onStopAnimation = {
                        scope.launch { displayController.stopAnimation() }
                    }
                )
            }
            composable(Route.Settings.path) {
                SettingsScreen(
                    settings = settings,
                    deviceStatus = deviceStatus,
                    onUpdateSettings = { transform ->
                        scope.launch { settingsManager.updateAndSync(transform) }
                    }
                )
            }
        }
    }
}
