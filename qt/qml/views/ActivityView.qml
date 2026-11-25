import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

ScrollView {
    id: root
    contentWidth: availableWidth
    clip: true

    property int selectedDayIndex: {
        var list = appController.weeklyActivity
        for (var i = 0; i < list.length; ++i) {
            if (list[i].isToday) return i
        }
        return 0
    }

    function maxChartMeters() {
        var list = appController.weeklyActivity
        var maxVal = Math.max(appController.dailyDistanceGoalMeters * 1.15, 1000)
        for (var i = 0; i < list.length; ++i) {
            if (list[i].distanceMeters > maxVal) {
                maxVal = list[i].distanceMeters * 1.12
            }
        }
        return maxVal
    }

    function weeklyTotalMeters() {
        var list = appController.weeklyActivity
        var sum = 0
        for (var i = 0; i < list.length; ++i) {
            sum += list[i].distanceMeters
        }
        return sum
    }

    function goalDaysCount() {
        var list = appController.weeklyActivity
        var count = 0
        for (var i = 0; i < list.length; ++i) {
            if (list[i].distanceMeters >= appController.dailyDistanceGoalMeters && list[i].hasData) {
                count += 1
            }
        }
        return count
    }

    function selectedDayData() {
        var list = appController.weeklyActivity
        if (!list || list.length === 0) {
            return { dayFull: "Today", dateLabel: "", isToday: true, steps: 0, distanceMeters: 0, hasData: false }
        }
        var idx = Math.max(0, Math.min(selectedDayIndex, list.length - 1))
        return list[idx]
    }

    function hrStatsText() {
        var samples = appController.heartRateSamples
        if (!samples || samples.length === 0) {
            return qsTr("No heart rate samples synced yet")
        }
        var minV = samples[0], maxV = samples[0], sum = 0
        for (var i = 0; i < samples.length; ++i) {
            if (samples[i] < minV) minV = samples[i]
            if (samples[i] > maxV) maxV = samples[i]
            sum += samples[i]
        }
        var avg = Math.round(sum / samples.length)
        return qsTr("Min %1 bpm · Avg %2 bpm · Max %3 bpm").arg(minV).arg(avg).arg(maxV)
    }

    function hrZoneText() {
        var bpm = appController.latestHeartRate
        if (bpm < 0) return qsTr("Awaiting reading")
        if (bpm < 60) return qsTr("Low resting")
        if (bpm <= 100) return qsTr("Normal resting")
        return qsTr("Elevated")
    }

    function spo2StatsText() {
        var samples = appController.spo2Samples
        if (!samples || samples.length === 0) {
            return qsTr("No SpO2 samples synced yet")
        }
        var minV = samples[0], maxV = samples[0], sum = 0
        for (var i = 0; i < samples.length; ++i) {
            if (samples[i] < minV) minV = samples[i]
            if (samples[i] > maxV) maxV = samples[i]
            sum += samples[i]
        }
        var avg = Math.round(sum / samples.length)
        return qsTr("Min %1% · Avg %2% · Max %3%").arg(minV).arg(avg).arg(maxV)
    }

    function spo2StatusText() {
        var val = appController.latestSpo2
        if (val < 0) return qsTr("Awaiting reading")
        if (val >= 95) return qsTr("Normal (95–100%)")
        if (val >= 90) return qsTr("Borderline (90–94%)")
        return qsTr("Low (< 90%)")
    }

    ColumnLayout {
        width: Math.min(root.availableWidth - 48, 960)
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: 24
        spacing: 20

        // 1. Compact Top Activity Summary Card (2x2 Grid + km/mi toggle + Refresh)
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: topCardCol.implicitHeight
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1
            clip: true

            ColumnLayout {
                id: topCardCol
                anchors.left: parent.left
                anchors.right: parent.right
                spacing: 0

                // Compact header strip
                RowLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 16
                    Layout.rightMargin: 16
                    Layout.topMargin: 10
                    Layout.bottomMargin: 10
                    spacing: 10

                    Label {
                        text: qsTr("Daily Activity")
                        font.pixelSize: 14
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                    }

                    Label {
                        text: qsTr("· %1").arg(appController.lastActivitySyncText)
                        font.pixelSize: 12
                        color: "#64748B"
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }

                    // Compact segmented km / mi toggle
                    Rectangle {
                        radius: 8
                        color: "#F1F5F9"
                        implicitHeight: 30
                        implicitWidth: unitRow.implicitWidth + 4

                        RowLayout {
                            id: unitRow
                            anchors.centerIn: parent
                            spacing: 2

                            Button {
                                text: "km"
                                flat: true
                                implicitHeight: 26
                                implicitWidth: 38
                                font.pixelSize: 11
                                font.weight: Font.DemiBold
                                onClicked: appController.distanceUnit = "km"
                                background: Rectangle {
                                    radius: 6
                                    color: appController.distanceUnit === "km" ? "#FFFFFF" : "transparent"
                                }
                                contentItem: Label {
                                    text: parent.text
                                    font: parent.font
                                    color: appController.distanceUnit === "km" ? "#2563EB" : "#64748B"
                                    horizontalAlignment: Text.AlignHCenter
                                    verticalAlignment: Text.AlignVCenter
                                }
                            }

                            Button {
                                text: "mi"
                                flat: true
                                implicitHeight: 26
                                implicitWidth: 38
                                font.pixelSize: 11
                                font.weight: Font.DemiBold
                                onClicked: appController.distanceUnit = "mi"
                                background: Rectangle {
                                    radius: 6
                                    color: appController.distanceUnit === "mi" ? "#FFFFFF" : "transparent"
                                }
                                contentItem: Label {
                                    text: parent.text
                                    font: parent.font
                                    color: appController.distanceUnit === "mi" ? "#2563EB" : "#64748B"
                                    horizontalAlignment: Text.AlignHCenter
                                    verticalAlignment: Text.AlignVCenter
                                }
                            }
                        }
                    }

                    Button {
                        text: appController.isSyncingActivity ? qsTr("Syncing...") : qsTr("Refresh")
                        highlighted: true
                        implicitHeight: 32
                        font.pixelSize: 12
                        enabled: appController.isConnected && !appController.isSyncingActivity
                        onClicked: appController.refreshActivity()
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    height: 1
                    color: "#E2E8F0"
                }

                // Compact 2x2 Metrics Grid
                GridLayout {
                    Layout.fillWidth: true
                    columns: 2
                    columnSpacing: 0
                    rowSpacing: 0

                    // Row 1, Col 1: Distance Walked
                    Item {
                        Layout.fillWidth: true
                        implicitHeight: distCol.implicitHeight + 24

                        ColumnLayout {
                            id: distCol
                            anchors.fill: parent
                            anchors.margins: 12
                            anchors.leftMargin: 16
                            anchors.rightMargin: 16
                            spacing: 2

                            Label {
                                text: qsTr("Distance Walked")
                                font.pixelSize: 11
                                font.weight: Font.Medium
                                color: "#64748B"
                            }
                            Label {
                                text: appController.todayDistanceMeters >= 0
                                      ? appController.formatDistanceWithUnit(appController.todayDistanceMeters)
                                      : qsTr("-- %1").arg(appController.distanceUnit)
                                font.pixelSize: 20
                                font.weight: Font.Bold
                                color: "#0F172A"
                            }
                            Label {
                                text: appController.todayDistanceMeters >= 0
                                      ? qsTr("%1% of %2 goal")
                                            .arg(Math.round((appController.todayDistanceMeters / Math.max(1, appController.dailyDistanceGoalMeters)) * 100))
                                            .arg(appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters))
                                      : qsTr("Goal %1").arg(appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters))
                                font.pixelSize: 11
                                color: appController.todayDistanceMeters >= appController.dailyDistanceGoalMeters ? "#16A34A" : "#64748B"
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }

                        Rectangle { anchors.right: parent.right; anchors.top: parent.top; anchors.bottom: parent.bottom; width: 1; color: "#E2E8F0" }
                        Rectangle { anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom; height: 1; color: "#E2E8F0" }
                    }

                    // Row 1, Col 2: Steps Taken
                    Item {
                        Layout.fillWidth: true
                        implicitHeight: stepsCol.implicitHeight + 24

                        ColumnLayout {
                            id: stepsCol
                            anchors.fill: parent
                            anchors.margins: 12
                            anchors.leftMargin: 16
                            anchors.rightMargin: 16
                            spacing: 2

                            Label {
                                text: qsTr("Steps Taken")
                                font.pixelSize: 11
                                font.weight: Font.Medium
                                color: "#64748B"
                            }
                            Label {
                                text: appController.todaySteps >= 0 ? appController.todaySteps.toLocaleString() : "--"
                                font.pixelSize: 20
                                font.weight: Font.Bold
                                color: "#0F172A"
                            }
                            Label {
                                text: appController.todaySteps >= 0
                                      ? qsTr("Today via 0xFEEA")
                                      : qsTr("Awaiting sync")
                                font.pixelSize: 11
                                color: "#64748B"
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }

                        Rectangle { anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom; height: 1; color: "#E2E8F0" }
                    }

                    // Row 2, Col 1: Heart Rate
                    Item {
                        Layout.fillWidth: true
                        implicitHeight: hrSummaryCol.implicitHeight + 24

                        ColumnLayout {
                            id: hrSummaryCol
                            anchors.fill: parent
                            anchors.margins: 12
                            anchors.leftMargin: 16
                            anchors.rightMargin: 16
                            spacing: 2

                            Label {
                                text: qsTr("Heart Rate")
                                font.pixelSize: 11
                                font.weight: Font.Medium
                                color: "#64748B"
                            }
                            Label {
                                text: appController.latestHeartRate > 0
                                      ? qsTr("%1 bpm").arg(appController.latestHeartRate)
                                      : qsTr("-- bpm")
                                font.pixelSize: 20
                                font.weight: Font.Bold
                                color: "#0F172A"
                            }
                            Label {
                                text: root.hrZoneText() + " · " + appController.heartRateUpdatedAt
                                font.pixelSize: 11
                                color: appController.latestHeartRate > 100 ? "#D97706" : (appController.latestHeartRate >= 60 ? "#16A34A" : "#64748B")
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }

                        Rectangle { anchors.right: parent.right; anchors.top: parent.top; anchors.bottom: parent.bottom; width: 1; color: "#E2E8F0" }
                    }

                    // Row 2, Col 2: SpO2
                    Item {
                        Layout.fillWidth: true
                        implicitHeight: spo2SummaryCol.implicitHeight + 24

                        ColumnLayout {
                            id: spo2SummaryCol
                            anchors.fill: parent
                            anchors.margins: 12
                            anchors.leftMargin: 16
                            anchors.rightMargin: 16
                            spacing: 2

                            Label {
                                text: qsTr("SpO2")
                                font.pixelSize: 11
                                font.weight: Font.Medium
                                color: "#64748B"
                            }
                            Label {
                                text: appController.latestSpo2 > 0
                                      ? qsTr("%1%").arg(appController.latestSpo2)
                                      : qsTr("--%")
                                font.pixelSize: 20
                                font.weight: Font.Bold
                                color: "#0F172A"
                            }
                            Label {
                                text: root.spo2StatusText() + " · " + appController.spo2UpdatedAt
                                font.pixelSize: 11
                                color: appController.latestSpo2 >= 95 ? "#16A34A" : (appController.latestSpo2 >= 90 ? "#D97706" : (appController.latestSpo2 > 0 ? "#DC2626" : "#64748B"))
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }
                    }
                }
            }
        }

        // 2. Weekly Distance Bar Chart Card (One interactive bar per day Mon–Sun)
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: chartCardCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: chartCardCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 16

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 12

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label {
                            text: qsTr("Weekly Distance")
                            font.pixelSize: 16
                            font.weight: Font.Bold
                            color: "#0F172A"
                        }
                        Label {
                            text: qsTr("Total %1 · %2 of 7 goal days")
                                  .arg(appController.formatDistanceWithUnit(root.weeklyTotalMeters()))
                                  .arg(root.goalDaysCount())
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                    }

                    // Daily goal stepper control
                    RowLayout {
                        spacing: 6
                        Label {
                            text: qsTr("Daily goal:")
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                        Button {
                            text: "-"
                            flat: true
                            implicitWidth: 32
                            implicitHeight: 32
                            onClicked: appController.dailyDistanceGoalMeters = Math.max(1000, appController.dailyDistanceGoalMeters - 500)
                        }
                        Label {
                            text: appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters)
                            font.pixelSize: 13
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                        }
                        Button {
                            text: "+"
                            flat: true
                            implicitWidth: 32
                            implicitHeight: 32
                            onClicked: appController.dailyDistanceGoalMeters = Math.min(50000, appController.dailyDistanceGoalMeters + 500)
                        }
                    }
                }

                // 7-day bar plot area with goal reference line
                Item {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 200

                    readonly property real plotHeight: 142
                    readonly property real maxMeters: root.maxChartMeters()
                    readonly property real goalRatio: Math.min(1.0, appController.dailyDistanceGoalMeters / Math.max(1, maxMeters))

                    // Goal reference line
                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: 22 + (parent.plotHeight * (1.0 - parent.goalRatio))
                        height: 1
                        color: "#CBD5E1"
                    }

                    Label {
                        anchors.right: parent.right
                        y: 6 + (parent.plotHeight * (1.0 - parent.goalRatio))
                        text: qsTr("Goal %1").arg(appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters))
                        font.pixelSize: 11
                        color: "#64748B"
                    }

                    RowLayout {
                        anchors.fill: parent
                        spacing: 8

                        Repeater {
                            model: appController.weeklyActivity
                            delegate: Item {
                                required property int index
                                required property var modelData
                                Layout.fillWidth: true
                                Layout.fillHeight: true

                                readonly property bool isSelected: index === root.selectedDayIndex
                                readonly property bool metGoal: modelData.hasData && modelData.distanceMeters >= appController.dailyDistanceGoalMeters
                                readonly property real barRatio: Math.min(1.0, modelData.distanceMeters / Math.max(1, root.maxChartMeters()))

                                MouseArea {
                                    anchors.fill: parent
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: root.selectedDayIndex = index
                                }

                                ColumnLayout {
                                    anchors.fill: parent
                                    spacing: 6

                                    // Value label above bar
                                    Label {
                                        Layout.alignment: Qt.AlignHCenter
                                        text: modelData.hasData ? appController.formatDistance(modelData.distanceMeters) : "0"
                                        font.pixelSize: 11
                                        font.weight: isSelected ? Font.Bold : Font.Medium
                                        color: isSelected ? "#2563EB" : "#64748B"
                                    }

                                    // Bar track
                                    Item {
                                        Layout.fillWidth: true
                                        Layout.fillHeight: true

                                        Rectangle {
                                            anchors.horizontalCenter: parent.horizontalCenter
                                            anchors.bottom: parent.bottom
                                            width: Math.min(parent.width - 8, 42)
                                            height: Math.max(6, parent.height * barRatio)
                                            radius: 6
                                            color: isSelected
                                                   ? "#2563EB"
                                                   : (metGoal ? "#93C5FD" : (modelData.hasData ? "#CBD5E1" : "#E2E8F0"))

                                            Behavior on color { ColorAnimation { duration: 150 } }
                                        }
                                    }

                                    // Weekday label
                                    Label {
                                        Layout.alignment: Qt.AlignHCenter
                                        text: modelData.dayShort
                                        font.pixelSize: 12
                                        font.weight: (isSelected || modelData.isToday) ? Font.Bold : Font.Normal
                                        color: isSelected ? "#2563EB" : (modelData.isToday ? "#0F172A" : "#64748B")
                                    }
                                }
                            }
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    height: 1
                    color: "#E2E8F0"
                }

                // Selected Day Detail Footer
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 16
                    property var day: root.selectedDayData()

                    Label {
                        text: day.isToday
                              ? qsTr("%1 (%2 · Today)").arg(day.dayFull).arg(day.dateLabel)
                              : qsTr("%1 (%2)").arg(day.dayFull).arg(day.dateLabel)
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                        Layout.fillWidth: true
                    }

                    Label {
                        text: day.hasData
                              ? qsTr("%1 · %2 steps")
                                    .arg(appController.formatDistanceWithUnit(day.distanceMeters))
                                    .arg(day.steps.toLocaleString())
                              : qsTr("No synced distance")
                        font.pixelSize: 13
                        font.weight: Font.Medium
                        color: "#0F172A"
                    }

                    Label {
                        readonly property int pct: Math.round((day.distanceMeters / Math.max(1, appController.dailyDistanceGoalMeters)) * 100)
                        text: !day.hasData
                              ? qsTr("0% of goal")
                              : (day.distanceMeters >= appController.dailyDistanceGoalMeters
                                 ? qsTr("Goal reached (%1%)").arg(pct)
                                 : qsTr("%1 to goal").arg(appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters - day.distanceMeters)))
                        font.pixelSize: 12
                        font.weight: Font.Medium
                        color: (day.hasData && day.distanceMeters >= appController.dailyDistanceGoalMeters) ? "#16A34A" : "#64748B"
                    }
                }
            }
        }

        // 3. Combined Split Card: Heart Rate (left) | SpO2 (right)
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: vitalsGrid.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            GridLayout {
                id: vitalsGrid
                anchors.fill: parent
                anchors.margins: 20
                columns: root.width < 680 ? 1 : 3
                columnSpacing: 20
                rowSpacing: 20

                // Left Half: Heart Rate
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        Label {
                            text: qsTr("Heart Rate")
                            font.pixelSize: 15
                            font.weight: Font.Bold
                            color: "#0F172A"
                            Layout.fillWidth: true
                        }
                        Label {
                            text: appController.heartRateUpdatedAt
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                    }

                    RowLayout {
                        spacing: 8
                        Label {
                            text: appController.latestHeartRate > 0 ? String(appController.latestHeartRate) : "--"
                            font.pixelSize: 32
                            font.weight: Font.Bold
                            color: appController.latestHeartRate > 0 ? "#DC2626" : "#0F172A"
                        }
                        Label {
                            text: "bpm"
                            font.pixelSize: 14
                            font.weight: Font.Medium
                            color: "#64748B"
                            Layout.alignment: Qt.AlignBottom
                            Layout.bottomMargin: 4
                        }
                        Item { Layout.fillWidth: true }
                        Label {
                            text: root.hrZoneText()
                            font.pixelSize: 12
                            font.weight: Font.Medium
                            color: appController.latestHeartRate > 100 ? "#D97706" : (appController.latestHeartRate >= 60 ? "#16A34A" : "#64748B")
                        }
                    }

                    Label {
                        text: root.hrStatsText()
                        font.pixelSize: 12
                        color: "#64748B"
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }

                    // Compact recent Heart Rate sample bar strip
                    Item {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 56

                        RowLayout {
                            anchors.fill: parent
                            spacing: 4
                            visible: appController.heartRateSamples.length > 0

                            Repeater {
                                model: appController.heartRateSamples
                                delegate: Item {
                                    required property var modelData
                                    Layout.fillWidth: true
                                    Layout.fillHeight: true
                                    readonly property real norm: Math.max(0.15, Math.min(1.0, (Number(modelData) - 45) / 115.0))

                                    Rectangle {
                                        anchors.bottom: parent.bottom
                                        anchors.left: parent.left
                                        anchors.right: parent.right
                                        height: parent.height * norm
                                        radius: 3
                                        color: "#FCA5A5"
                                    }
                                }
                            }
                        }

                        Label {
                            anchors.centerIn: parent
                            visible: appController.heartRateSamples.length === 0
                            text: qsTr("Recent BPM trend appears after sync")
                            font.pixelSize: 12
                            color: "#94A3B8"
                        }
                    }
                }

                // Hairline divider (vertical on desktop, horizontal on compact)
                Rectangle {
                    Layout.fillHeight: root.width >= 680
                    Layout.fillWidth: root.width < 680
                    Layout.preferredWidth: root.width >= 680 ? 1 : -1
                    Layout.preferredHeight: root.width < 680 ? 1 : -1
                    color: "#E2E8F0"
                }

                // Right Half: SpO2 (Blood Oxygen)
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        Label {
                            text: qsTr("SpO2")
                            font.pixelSize: 15
                            font.weight: Font.Bold
                            color: "#0F172A"
                            Layout.fillWidth: true
                        }
                        Label {
                            text: appController.spo2UpdatedAt
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                    }

                    RowLayout {
                        spacing: 6
                        Label {
                            text: appController.latestSpo2 > 0 ? String(appController.latestSpo2) : "--"
                            font.pixelSize: 32
                            font.weight: Font.Bold
                            color: appController.latestSpo2 > 0 ? "#0284C7" : "#0F172A"
                        }
                        Label {
                            text: "%"
                            font.pixelSize: 14
                            font.weight: Font.Medium
                            color: "#64748B"
                            Layout.alignment: Qt.AlignBottom
                            Layout.bottomMargin: 4
                        }
                        Item { Layout.fillWidth: true }
                        Label {
                            text: root.spo2StatusText()
                            font.pixelSize: 12
                            font.weight: Font.Medium
                            color: appController.latestSpo2 >= 95 ? "#16A34A" : (appController.latestSpo2 >= 90 ? "#D97706" : (appController.latestSpo2 > 0 ? "#DC2626" : "#64748B"))
                        }
                    }

                    Label {
                        text: root.spo2StatsText()
                        font.pixelSize: 12
                        color: "#64748B"
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }

                    // Compact recent SpO2 sample bar strip
                    Item {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 56

                        RowLayout {
                            anchors.fill: parent
                            spacing: 4
                            visible: appController.spo2Samples.length > 0

                            Repeater {
                                model: appController.spo2Samples
                                delegate: Item {
                                    required property var modelData
                                    Layout.fillWidth: true
                                    Layout.fillHeight: true
                                    readonly property real norm: Math.max(0.15, Math.min(1.0, (Number(modelData) - 85) / 15.0))

                                    Rectangle {
                                        anchors.bottom: parent.bottom
                                        anchors.left: parent.left
                                        anchors.right: parent.right
                                        height: parent.height * norm
                                        radius: 3
                                        color: "#7DD3FC"
                                    }
                                }
                            }
                        }

                        Label {
                            anchors.centerIn: parent
                            visible: appController.spo2Samples.length === 0
                            text: qsTr("Recent SpO2 trend appears after sync")
                            font.pixelSize: 12
                            color: "#94A3B8"
                        }
                    }
                }
            }
        }

        Item { Layout.preferredHeight: 24 }
    }
}
