package expo.modules.floatingpill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FloatingPillModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("FloatingPill")

    Events(FloatingPillEvents.EVENT_TOGGLE, FloatingPillEvents.EVENT_OPEN)

    OnStartObserving {
      registerReceiver()
    }

    OnStopObserving {
      unregisterReceiver()
    }

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
    }

    AsyncFunction("hasOverlayPermission") {
      hasOverlayPermission()
    }

    AsyncFunction("requestOverlayPermission") {
      val activity = appContext.currentActivity
      if (hasOverlayPermission()) {
        return@AsyncFunction true
      }
      if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val uri = Uri.parse("package:${activity.packageName}")
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, uri)
        activity.startActivity(intent)
      }
      false
    }

    AsyncFunction("show") { state: Map<String, Any?> ->
      updateService(state, FloatingPillEvents.ACTION_UPDATE)
    }

    AsyncFunction("update") { state: Map<String, Any?> ->
      updateService(state, FloatingPillEvents.ACTION_UPDATE)
    }

    AsyncFunction("hide") {
      appContext.reactContext?.let { context ->
        val intent = Intent(context, FloatingPillService::class.java).apply {
          action = FloatingPillEvents.ACTION_HIDE
        }
        context.startService(intent)
      }
    }
  }

  private fun hasOverlayPermission(): Boolean {
    val context = appContext.reactContext ?: return false
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
  }

  private fun updateService(state: Map<String, Any?>, actionName: String) {
    val context = appContext.reactContext ?: return
    if (!hasOverlayPermission()) return
    val intent = Intent(context, FloatingPillService::class.java).apply {
      action = actionName
      putExtra(FloatingPillEvents.EXTRA_LABEL, state[FloatingPillEvents.EXTRA_LABEL] as? String ?: "")
      putExtra(FloatingPillEvents.EXTRA_TIME, state[FloatingPillEvents.EXTRA_TIME] as? String ?: "")
      putExtra(FloatingPillEvents.EXTRA_TASK, state[FloatingPillEvents.EXTRA_TASK] as? String ?: "")
      putExtra(FloatingPillEvents.EXTRA_RUNNING, state[FloatingPillEvents.EXTRA_RUNNING] as? Boolean ?: false)
      putExtra(FloatingPillEvents.EXTRA_COLOR, state[FloatingPillEvents.EXTRA_COLOR] as? String ?: "#c8442a")
      putExtra(FloatingPillEvents.EXTRA_SHAPE, state[FloatingPillEvents.EXTRA_SHAPE] as? String ?: "classic")
      putExtra(FloatingPillEvents.EXTRA_MODE, state[FloatingPillEvents.EXTRA_MODE] as? String ?: "pomodoro")
      (state[FloatingPillEvents.EXTRA_END_AT] as? Number)?.let {
        putExtra(FloatingPillEvents.EXTRA_END_AT, it.toLong())
      }
      (state[FloatingPillEvents.EXTRA_TOTAL_MS] as? Number)?.let {
        putExtra(FloatingPillEvents.EXTRA_TOTAL_MS, it.toLong())
      }
      (state[FloatingPillEvents.EXTRA_STARTED_AT] as? Number)?.let {
        putExtra(FloatingPillEvents.EXTRA_STARTED_AT, it.toLong())
      }
      (state[FloatingPillEvents.EXTRA_ELAPSED_MS] as? Number)?.let {
        putExtra(FloatingPillEvents.EXTRA_ELAPSED_MS, it.toLong())
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  private fun registerReceiver() {
    val context = appContext.reactContext ?: return
    if (receiver != null) return
    receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
          FloatingPillEvents.ACTION_TOGGLE -> sendEvent(FloatingPillEvents.EVENT_TOGGLE)
          FloatingPillEvents.ACTION_OPEN -> sendEvent(FloatingPillEvents.EVENT_OPEN)
        }
      }
    }
    val filter = IntentFilter().apply {
      addAction(FloatingPillEvents.ACTION_TOGGLE)
      addAction(FloatingPillEvents.ACTION_OPEN)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      context.registerReceiver(receiver, filter)
    }
  }

  private fun unregisterReceiver() {
    val context = appContext.reactContext ?: return
    receiver?.let {
      runCatching { context.unregisterReceiver(it) }
    }
    receiver = null
  }
}
