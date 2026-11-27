import QtQuick

Canvas {
    id: iconCanvas

    property string name: "overview"
    property color color: "#0F172A"
    property real size: 20
    property real strokeWidth: 2.0

    implicitWidth: size
    implicitHeight: size
    width: size
    height: size
    antialiasing: true
    renderStrategy: Canvas.Cooperative

    onNameChanged: requestPaint()
    onColorChanged: requestPaint()
    onSizeChanged: requestPaint()
    onStrokeWidthChanged: requestPaint()
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    onVisibleChanged: if (visible) requestPaint()

    onPaint: {
        var ctx = getContext("2d")
        if (!ctx) return
        ctx.reset()
        ctx.clearRect(0, 0, width, height)

        var s = Math.min(width, height) / 24.0
        if (s <= 0) return

        ctx.save()
        ctx.scale(s, s)
        ctx.strokeStyle = iconCanvas.color
        ctx.fillStyle = iconCanvas.color
        ctx.lineWidth = iconCanvas.strokeWidth
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        function roundedRect(x, y, w, h, r) {
            ctx.beginPath()
            ctx.moveTo(x + r, y)
            ctx.lineTo(x + w - r, y)
            ctx.quadraticCurveTo(x + w, y, x + w, y + r)
            ctx.lineTo(x + w, y + h - r)
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
            ctx.lineTo(x + r, y + h)
            ctx.quadraticCurveTo(x, y + h, x, y + h - r)
            ctx.lineTo(x, y + r)
            ctx.quadraticCurveTo(x, y, x + r, y)
            ctx.closePath()
            ctx.stroke()
        }

        if (name === "overview") {
            roundedRect(3, 3, 7, 7, 1.5)
            roundedRect(14, 3, 7, 7, 1.5)
            roundedRect(3, 14, 7, 7, 1.5)
            roundedRect(14, 14, 7, 7, 1.5)
        } else if (name === "activity") {
            ctx.beginPath()
            ctx.moveTo(2, 12)
            ctx.lineTo(6, 12)
            ctx.lineTo(9, 4)
            ctx.lineTo(15, 20)
            ctx.lineTo(18, 12)
            ctx.lineTo(22, 12)
            ctx.stroke()
        } else if (name === "time") {
            ctx.beginPath()
            ctx.arc(12, 12, 9, 0, Math.PI * 2)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(12, 7)
            ctx.lineTo(12, 12)
            ctx.lineTo(15.5, 14)
            ctx.stroke()
        } else if (name === "alerts") {
            ctx.beginPath()
            ctx.moveTo(18, 16)
            ctx.lineTo(6, 16)
            ctx.bezierCurveTo(7.5, 14.5, 7.5, 12.5, 7.5, 10)
            ctx.arc(12, 10, 4.5, Math.PI, 0, false)
            ctx.bezierCurveTo(16.5, 12.5, 16.5, 14.5, 18, 16)
            ctx.closePath()
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(4.5, 16)
            ctx.lineTo(19.5, 16)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(12, 19.2, 1.8, 0.1 * Math.PI, 0.9 * Math.PI)
            ctx.stroke()
        } else if (name === "device") {
            roundedRect(6, 6, 12, 12, 2.5)
            roundedRect(9.5, 9.5, 5, 5, 1)
            ctx.beginPath()
            // Top pins
            ctx.moveTo(9, 3); ctx.lineTo(9, 6)
            ctx.moveTo(15, 3); ctx.lineTo(15, 6)
            // Bottom pins
            ctx.moveTo(9, 18); ctx.lineTo(9, 21)
            ctx.moveTo(15, 18); ctx.lineTo(15, 21)
            // Left pins
            ctx.moveTo(3, 9); ctx.lineTo(6, 9)
            ctx.moveTo(3, 15); ctx.lineTo(6, 15)
            // Right pins
            ctx.moveTo(18, 9); ctx.lineTo(21, 9)
            ctx.moveTo(18, 15); ctx.lineTo(21, 15)
            ctx.stroke()
        } else if (name === "refresh") {
            ctx.beginPath()
            ctx.arc(12, 12, 7.5, 0.35 * Math.PI, 1.85 * Math.PI)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(16.2, 4.2)
            ctx.lineTo(19.2, 7.2)
            ctx.lineTo(15.2, 8.2)
            ctx.stroke()
        } else if (name === "distance") {
            ctx.beginPath()
            ctx.arc(12, 9.5, 5.8, Math.PI, 0, false)
            ctx.bezierCurveTo(17.8, 14, 12, 20.5, 12, 20.5)
            ctx.bezierCurveTo(12, 20.5, 6.2, 14, 6.2, 9.5)
            ctx.closePath()
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(12, 9.5, 2.1, 0, Math.PI * 2)
            ctx.stroke()
        } else if (name === "steps") {
            // Left footprint
            roundedRect(5, 4, 4.5, 7.5, 2.2)
            ctx.beginPath()
            ctx.arc(7.25, 15.2, 1.7, 0, Math.PI * 2)
            ctx.stroke()
            // Right footprint
            roundedRect(14.5, 8.5, 4.5, 7.5, 2.2)
            ctx.beginPath()
            ctx.arc(16.75, 19.6, 1.7, 0, Math.PI * 2)
            ctx.stroke()
        } else if (name === "heart") {
            ctx.beginPath()
            ctx.moveTo(12, 20)
            ctx.bezierCurveTo(12, 20, 4, 14.6, 4, 9.2)
            ctx.bezierCurveTo(4, 6.2, 6.4, 4, 9.1, 4)
            ctx.bezierCurveTo(10.8, 4, 11.7, 5, 12, 6.2)
            ctx.bezierCurveTo(12.3, 5, 13.2, 4, 14.9, 4)
            ctx.bezierCurveTo(17.6, 4, 20, 6.2, 20, 9.2)
            ctx.bezierCurveTo(20, 14.6, 12, 20, 12, 20)
            ctx.closePath()
            ctx.stroke()
        } else if (name === "droplet") {
            ctx.beginPath()
            ctx.moveTo(12, 3.2)
            ctx.bezierCurveTo(12, 3.2, 18.5, 10.2, 18.5, 14.4)
            ctx.arc(12, 14.4, 6.5, 0, Math.PI, false)
            ctx.bezierCurveTo(5.5, 10.2, 12, 3.2, 12, 3.2)
            ctx.closePath()
            ctx.stroke()
        } else if (name === "gauge") {
            ctx.beginPath()
            ctx.arc(12, 13.5, 8.2, 0.85 * Math.PI, 2.15 * Math.PI, false)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(12, 13.5)
            ctx.lineTo(16.5, 9.2)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(12, 13.5, 1.6, 0, Math.PI * 2)
            ctx.fill()
        } else if (name === "battery") {
            roundedRect(2.5, 7, 16, 10, 2)
            ctx.beginPath()
            ctx.moveTo(21, 10)
            ctx.lineTo(21, 14)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(6.5, 10)
            ctx.lineTo(6.5, 14)
            ctx.moveTo(10.5, 10)
            ctx.lineTo(10.5, 14)
            ctx.stroke()
        } else if (name === "find") {
            // Watch face + vibration waves
            roundedRect(7.5, 6.5, 9, 11, 2.5)
            ctx.beginPath()
            ctx.moveTo(9.5, 3.5); ctx.lineTo(14.5, 3.5)
            ctx.moveTo(9.5, 20.5); ctx.lineTo(14.5, 20.5)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(12, 12, 8.5, 0.82 * Math.PI, 1.18 * Math.PI)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(12, 12, 8.5, -0.18 * Math.PI, 0.18 * Math.PI)
            ctx.stroke()
        } else if (name === "bluetooth") {
            ctx.beginPath()
            ctx.moveTo(7, 7)
            ctx.lineTo(17, 17)
            ctx.lineTo(12, 21)
            ctx.lineTo(12, 3)
            ctx.lineTo(17, 7)
            ctx.lineTo(7, 17)
            ctx.stroke()
        } else if (name === "calendar") {
            roundedRect(3.5, 5.5, 17, 15, 2)
            ctx.beginPath()
            ctx.moveTo(3.5, 10)
            ctx.lineTo(20.5, 10)
            ctx.moveTo(8, 3.5)
            ctx.lineTo(8, 7)
            ctx.moveTo(16, 3.5)
            ctx.lineTo(16, 7)
            ctx.stroke()
        } else if (name === "copy") {
            roundedRect(9, 9, 11, 11, 2)
            ctx.beginPath()
            ctx.moveTo(6, 15)
            ctx.lineTo(5, 15)
            ctx.quadraticCurveTo(4, 15, 4, 14)
            ctx.lineTo(4, 5)
            ctx.quadraticCurveTo(4, 4, 5, 4)
            ctx.lineTo(14, 4)
            ctx.quadraticCurveTo(15, 4, 15, 5)
            ctx.lineTo(15, 6)
            ctx.stroke()
        } else if (name === "check") {
            ctx.beginPath()
            ctx.moveTo(5, 12.5)
            ctx.lineTo(9.8, 17.2)
            ctx.lineTo(19, 7.2)
            ctx.stroke()
        } else if (name === "trash") {
            ctx.beginPath()
            ctx.moveTo(4, 6.5)
            ctx.lineTo(20, 6.5)
            ctx.moveTo(9.5, 6.5)
            ctx.lineTo(9.5, 4.5)
            ctx.lineTo(14.5, 4.5)
            ctx.lineTo(14.5, 6.5)
            ctx.moveTo(6.5, 6.5)
            ctx.lineTo(7.4, 19)
            ctx.quadraticCurveTo(7.5, 20, 8.5, 20)
            ctx.lineTo(15.5, 20)
            ctx.quadraticCurveTo(16.5, 20, 16.6, 19)
            ctx.lineTo(17.5, 6.5)
            ctx.moveTo(10.2, 10.5)
            ctx.lineTo(10.2, 16.5)
            ctx.moveTo(13.8, 10.5)
            ctx.lineTo(13.8, 16.5)
            ctx.stroke()
        }

        ctx.restore()
    }
}
