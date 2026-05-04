package expo.modules.floatingpill

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat

class FloatingPillService : Service() {
  private var windowManager: WindowManager? = null
  private var pillView: View? = null
  private var layoutParams: WindowManager.LayoutParams? = null
  private var labelView: TextView? = null
  private var timeView: TextView? = null
  private var taskView: TextView? = null
  private var textColView: LinearLayout? = null
  private var toggleView: TextView? = null
  private var dotView: View? = null
  private val handler = Handler(Looper.getMainLooper())
  private var currentState: FloatingPillState? = null
  private var downRawX = 0f
  private var downRawY = 0f
  private var downX = 0
  private var downY = 0
  private var moved = false
  private val tickRunnable = object : Runnable {
    override fun run() {
      val state = currentState ?: return
      if (state.running) {
        val updated = state.copy(time = formatDisplayTime(state))
        currentState = updated
        updatePill(updated)
        startForeground(NOTIFICATION_ID, buildNotification(updated))
        handler.postDelayed(this, 1000L)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == FloatingPillEvents.ACTION_HIDE) {
      hide()
      return START_NOT_STICKY
    }
    if (!canDrawOverlays()) {
      hide()
      return START_NOT_STICKY
    }

    val state = FloatingPillState(
      label = intent?.getStringExtra(FloatingPillEvents.EXTRA_LABEL).orEmpty(),
      time = intent?.getStringExtra(FloatingPillEvents.EXTRA_TIME).orEmpty(),
      task = intent?.getStringExtra(FloatingPillEvents.EXTRA_TASK).orEmpty(),
      running = intent?.getBooleanExtra(FloatingPillEvents.EXTRA_RUNNING, false) ?: false,
      color = parseColor(intent?.getStringExtra(FloatingPillEvents.EXTRA_COLOR)),
      endAt = intent?.getLongExtra(FloatingPillEvents.EXTRA_END_AT, 0L) ?: 0L,
      totalMs = intent?.getLongExtra(FloatingPillEvents.EXTRA_TOTAL_MS, 0L) ?: 0L,
      shape = intent?.getStringExtra(FloatingPillEvents.EXTRA_SHAPE).orEmpty().ifBlank { "classic" },
      mode = intent?.getStringExtra(FloatingPillEvents.EXTRA_MODE).orEmpty().ifBlank { "pomodoro" },
      startedAt = intent?.getLongExtra(FloatingPillEvents.EXTRA_STARTED_AT, 0L) ?: 0L,
      elapsedMs = intent?.getLongExtra(FloatingPillEvents.EXTRA_ELAPSED_MS, 0L) ?: 0L,
    )

    currentState = state
    startForeground(NOTIFICATION_ID, buildNotification(state))
    if (pillView == null) addPill(state) else updatePill(state)
    scheduleTick(state)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tickRunnable)
    hideView()
    super.onDestroy()
  }

  private fun addPill(state: FloatingPillState) {
    val view = buildPillView(state)
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = 24
      y = 140
    }

    layoutParams = params
    pillView = view
    windowManager?.addView(view, params)
  }

  private fun buildPillView(state: FloatingPillState): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(
        if (state.shape == "compact") 14.dp else 18.dp,
        if (state.shape == "compact") 8.dp else 10.dp,
        if (state.shape == "compact") 6.dp else 10.dp,
        if (state.shape == "compact") 8.dp else 10.dp,
      )
      background = PillDrawable(state.shape)
      elevation = 10.dp.toFloat()
    }

    dotView = View(this).apply {
      background = DotDrawable(state.color)
    }
    root.addView(dotView, LinearLayout.LayoutParams(10.dp, 10.dp).apply {
      marginEnd = 10.dp
    })

    val textCol = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
    }
    textColView = textCol
    labelView = TextView(this).apply {
      textSize = 11f
      setTextColor(Color.parseColor("#8d7d78"))
      isAllCaps = true
      text = state.label
    }
    timeView = TextView(this).apply {
      textSize = 20f
      setTextColor(Color.parseColor("#201615"))
      typeface = android.graphics.Typeface.DEFAULT_BOLD
      text = state.time
    }
    taskView = TextView(this).apply {
      textSize = 11f
      setTextColor(Color.parseColor("#8d7d78"))
      maxLines = 1
      text = state.task
      visibility = if (state.task.isBlank()) View.GONE else View.VISIBLE
    }
    textCol.addView(labelView)
    textCol.addView(timeView)
    textCol.addView(taskView)
    root.addView(
      textCol,
      LinearLayout.LayoutParams(
        if (state.shape == "compact") LinearLayout.LayoutParams.WRAP_CONTENT else 150.dp,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply {
        marginEnd = if (state.shape == "compact") 6.dp else 0
      },
    )

    toggleView = TextView(this).apply {
      textSize = if (state.shape == "compact") 16f else 18f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      background = CircleDrawable(state.color)
      text = if (state.running) "Ⅱ" else "▶"
      setOnClickListener {
        sendBroadcast(Intent(FloatingPillEvents.ACTION_TOGGLE).setPackage(packageName))
      }
    }
    root.addView(
      toggleView,
      LinearLayout.LayoutParams(
        if (state.shape == "compact") 32.dp else 38.dp,
        if (state.shape == "compact") 32.dp else 38.dp,
      ),
    )

    root.setOnClickListener {
      sendBroadcast(Intent(FloatingPillEvents.ACTION_OPEN).setPackage(packageName))
      val launch = packageManager.getLaunchIntentForPackage(packageName)
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(launch)
      }
    }
    root.setOnTouchListener(::handleTouch)
    return root
  }

  private fun updatePill(state: FloatingPillState) {
    val root = pillView as? LinearLayout
    root?.background = PillDrawable(state.shape)
    labelView?.text = state.label
    timeView?.text = state.time
    taskView?.text = state.task
    taskView?.visibility = if (state.task.isBlank()) View.GONE else View.VISIBLE
    toggleView?.text = if (state.running) "Ⅱ" else "▶"
    dotView?.background = DotDrawable(state.color)
    toggleView?.background = CircleDrawable(state.color)
    textColView?.layoutParams = textColView?.layoutParams?.apply {
      if (this is LinearLayout.LayoutParams) {
        width = if (state.shape == "compact") LinearLayout.LayoutParams.WRAP_CONTENT else 150.dp
        marginEnd = if (state.shape == "compact") 6.dp else 0
      }
    }
    toggleView?.layoutParams = toggleView?.layoutParams?.apply {
      width = if (state.shape == "compact") 32.dp else 38.dp
      height = if (state.shape == "compact") 32.dp else 38.dp
    }
    toggleView?.textSize = if (state.shape == "compact") 16f else 18f
  }

  private fun handleTouch(view: View, event: MotionEvent): Boolean {
    val params = layoutParams ?: return false
    when (event.action) {
      MotionEvent.ACTION_DOWN -> {
        downRawX = event.rawX
        downRawY = event.rawY
        downX = params.x
        downY = params.y
        moved = false
        return false
      }
      MotionEvent.ACTION_MOVE -> {
        val dx = (event.rawX - downRawX).toInt()
        val dy = (event.rawY - downRawY).toInt()
        if (kotlin.math.abs(dx) > 8 || kotlin.math.abs(dy) > 8) moved = true
        params.x = downX + dx
        params.y = downY + dy
        windowManager?.updateViewLayout(view, params)
        return true
      }
      MotionEvent.ACTION_UP -> return moved
    }
    return false
  }

  private fun hide() {
    handler.removeCallbacks(tickRunnable)
    currentState = null
    hideView()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun hideView() {
    pillView?.let { view ->
      runCatching { windowManager?.removeView(view) }
    }
    pillView = null
  }

  private fun canDrawOverlays(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Floating timer pill",
      NotificationManager.IMPORTANCE_LOW,
    )
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun buildNotification(state: FloatingPillState): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("${state.label} • ${state.time}")
      .setContentText(if (state.task.isBlank()) "Pomodoro floating timer" else state.task)
      .setOngoing(true)
      .setSilent(true)
      .setContentIntent(launch)
      .build()
  }

  private fun parseColor(value: String?): Int {
    return runCatching { Color.parseColor(value ?: "#c8442a") }.getOrDefault(Color.parseColor("#c8442a"))
  }

  private fun scheduleTick(state: FloatingPillState) {
    handler.removeCallbacks(tickRunnable)
    if (state.running && (state.endAt > 0L || state.mode == "stopwatch")) {
      handler.postDelayed(tickRunnable, 1000L)
    }
  }

  private fun formatDisplayTime(state: FloatingPillState): String {
    return if (state.mode == "stopwatch") {
      formatElapsed(System.currentTimeMillis() - state.startedAt + state.elapsedMs)
    } else {
      formatRemaining(state.endAt - System.currentTimeMillis())
    }
  }

  private fun formatRemaining(remainingMs: Long): String {
    val totalSeconds = kotlin.math.max(0L, (remainingMs + 999L) / 1000L)
    val minutes = totalSeconds / 60L
    val seconds = totalSeconds % 60L
    return "${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}"
  }

  private fun formatElapsed(elapsedMs: Long): String {
    val totalSeconds = kotlin.math.max(0L, elapsedMs / 1000L)
    val minutes = totalSeconds / 60L
    val seconds = totalSeconds % 60L
    return "${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}"
  }

  private val Int.dp: Int
    get() = (this * resources.displayMetrics.density).toInt()

  private data class FloatingPillState(
    val label: String,
    val time: String,
    val task: String,
    val running: Boolean,
    val color: Int,
    val endAt: Long,
    val totalMs: Long,
    val shape: String,
    val mode: String,
    val startedAt: Long,
    val elapsedMs: Long,
  )

  companion object {
    private const val CHANNEL_ID = "pomodoro-floating-pill"
    private const val NOTIFICATION_ID = 4242
  }
}
