package com.minicast.app.eye

import com.minicast.app.bluetooth.EyeExpression

data class ExpressionMeta(
    val expression: EyeExpression,
    val title: String,
    val subtitle: String
)

class ExpressionManager {
    val allExpressions: List<ExpressionMeta> = listOf(
        ExpressionMeta(EyeExpression.NEUTRAL, "Neutral", "Calm natural blink and gaze"),
        ExpressionMeta(EyeExpression.HAPPY, "Happy", "Warm curved lower squint"),
        ExpressionMeta(EyeExpression.EXCITED, "Excited", "Wide bright alert pupil"),
        ExpressionMeta(EyeExpression.CURIOUS, "Curious", "Tilted attentive side glance"),
        ExpressionMeta(EyeExpression.SLEEPY, "Sleepy", "Heavy half-closed eyelids"),
        ExpressionMeta(EyeExpression.SURPRISED, "Surprised", "Tall wide sclera, pinpoint pupil"),
        ExpressionMeta(EyeExpression.SAD, "Sad", "Drooping outer brow corners"),
        ExpressionMeta(EyeExpression.ANGRY, "Angry", "Sharply angled furrowed brow")
    )
}
