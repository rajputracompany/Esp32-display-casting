package com.minicast.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import com.minicast.app.bluetooth.BluetoothManager
import com.minicast.app.bluetooth.BluetoothService
import com.minicast.app.display.BitmapTransfer
import com.minicast.app.display.DisplayController
import com.minicast.app.eye.ExpressionManager
import com.minicast.app.eye.EyeController
import com.minicast.app.navigation.MiniCastNav
import com.minicast.app.settings.SettingsManager
import com.minicast.app.ui.theme.MiniCastTheme

class MainActivity : ComponentActivity() {
    private lateinit var btManager: BluetoothManager
    private lateinit var btService: BluetoothService
    private lateinit var eyeController: EyeController
    private lateinit var expressionManager: ExpressionManager
    private lateinit var displayController: DisplayController
    private lateinit var settingsManager: SettingsManager

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) {
            btManager.refreshPairedDevices()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        btManager = BluetoothManager(applicationContext)
        btService = BluetoothService(btManager)
        eyeController = EyeController(btService)
        expressionManager = ExpressionManager()
        displayController = DisplayController(btService, BitmapTransfer(btService))
        settingsManager = SettingsManager(applicationContext, btService)

        requestBluetoothPermissions()

        setContent {
            MiniCastTheme {
                MiniCastNav(
                    btManager = btManager,
                    btService = btService,
                    eyeController = eyeController,
                    expressionManager = expressionManager,
                    displayController = displayController,
                    settingsManager = settingsManager,
                    onRequestBluetoothPermissions = ::requestBluetoothPermissions
                )
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        btService.disconnect()
    }

    private fun requestBluetoothPermissions() {
        val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            )
        } else {
            arrayOf(
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        }
        permissionLauncher.launch(perms)
    }
}
