package expo.modules.floatingpill

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.drawable.Drawable

class PillDrawable : Drawable() {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#fffaf8")
    setShadowLayer(14f, 0f, 5f, Color.argb(55, 0, 0, 0))
  }

  override fun draw(canvas: Canvas) {
    val rect = RectF(bounds)
    canvas.drawRoundRect(rect, rect.height() / 2f, rect.height() / 2f, paint)
  }

  override fun setAlpha(alpha: Int) {
    paint.alpha = alpha
  }

  override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) {
    paint.colorFilter = colorFilter
  }

  @Deprecated("Deprecated in Java")
  override fun getOpacity(): Int = android.graphics.PixelFormat.TRANSLUCENT
}

open class CircleDrawable(private val color: Int) : Drawable() {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = this@CircleDrawable.color
  }

  override fun draw(canvas: Canvas) {
    canvas.drawCircle(bounds.exactCenterX(), bounds.exactCenterY(), bounds.width() / 2f, paint)
  }

  override fun setAlpha(alpha: Int) {
    paint.alpha = alpha
  }

  override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) {
    paint.colorFilter = colorFilter
  }

  @Deprecated("Deprecated in Java")
  override fun getOpacity(): Int = android.graphics.PixelFormat.TRANSLUCENT
}

class DotDrawable(color: Int) : CircleDrawable(color)
