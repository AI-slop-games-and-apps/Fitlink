import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import FitLink

ScrollView {
    id: root
    contentWidth: availableWidth
    clip: true
    readonly property bool isNarrow: root.availableWidth < 560

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

    function bpStatsText() {
        var samples = appController.bloodPressureSamples
        if (!samples || samples.length === 0) {
            return qsTr("No blood pressure samples yet")
        }
        var sumSys = 0, sumDia = 0
        for (var i = 0; i < samples.length; ++i) {
            sumSys += Number(samples[i].systolic)
            sumDia += Number(samples[i].diastolic)
        }
        var avgSys = Math.round(sumSys / samples.length)
        var avgDia = Math.round(sumDia / samples.length)
        return qsTr("Avg %1/%2 mmHg · %3 readings").arg(avgSys).arg(avgDia).arg(samples.length)
    }

    function bpStatusText() {
        var sys = appController.latestSystolic
        var dia = appController.latestDiastolic
        if (sys <= 0 || dia <= 0) return qsTr("Awaiting reading")
        if (sys < 120 && dia < 80) return qsTr("Normal")
        if (sys < 130 && dia < 80) return qsTr("Elevated")
        return qsTr("High")
    }

    ColumnLayout {
        width: root.isNarrow ? root.availableWidth - 24 : Math.min(root.availableWidth - 48, 960)
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: 20
        spacing: 18

        // 1. Top Activity Summary Card (2x2 Grid + km/mi toggle + Refresh)
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

                // Responsive header strip (stacks cleanly on phones so Refresh & km/mi stay full-size)
                GridLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 16
                    Layout.rightMargin: 16
                    Layout.topMargin: 14
                    Layout.bottomMargin: 14
                    columns: root.isNarrow ? 1 : 2
                    columnSpacing: 12
                    rowSpacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 10

                        Rectangle {
                            width: 34
                            height: 34
                            radius: 9
                            color: "#EFF6FF"
                            FitIcon {
                                anchors.centerIn: parent
                                name: "activity"
                                size: 18
                                color: "#2563EB"
                            }
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 1
                            Label {
                                text: qsTr("Daily Activity")
                                font.pixelSize: 16
                                font.weight: Font.Bold
                                color: "#0F172A"
                            }
                            Label {
                                text: appController.lastActivitySyncText
                                font.pixelSize: 12
                                color: "#64748B"
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }
                    }

                    RowLayout {
                        Layout.fillWidth: root.isNarrow
                        Layout.alignment: root.isNarrow ? Qt.AlignLeft : Qt.AlignRight
                        spacing: 10

                        // Touch-friendly segmented km / mi toggle
                        Rectangle {
                            radius: 10
                            color: "#F1F5F9"
                            implicitHeight: 42
                            implicitWidth: unitRow.implicitWidth + 8

                            RowLayout {
                                id: unitRow
                                anchors.centerIn: parent
                                spacing: 4

                                AbstractButton {
                                    padding: 0
                                    implicitHeight: 34
                                    implicitWidth: 48
                                    onClicked: appController.distanceUnit = "km"
                                    background: Rectangle {
                                        radius: 8
                                        color: appController.distanceUnit === "km" ? "#FFFFFF" : "transparent"
                                    }
                                    contentItem: Label {
                                        text: "km"
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        color: appController.distanceUnit === "km" ? "#2563EB" : "#64748B"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }

                                AbstractButton {
                                    padding: 0
                                    implicitHeight: 34
                                    implicitWidth: 48
                                    onClicked: appController.distanceUnit = "mi"
                                    background: Rectangle {
                                        radius: 8
                                        color: appController.distanceUnit === "mi" ? "#FFFFFF" : "transparent"
                                    }
                                    contentItem: Label {
                                        text: "mi"
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        color: appController.distanceUnit === "mi" ? "#2563EB" : "#64748B"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }
                            }
                        }

                        Item {
                            visible: root.isNarrow
                            Layout.fillWidth: true
                        }

                        AbstractButton {
                            id: refreshActivityBtn
                            padding: 0
                            enabled: appController.isConnected && !appController.isSyncingActivity
                            implicitHeight: 42
                            implicitWidth: Math.max(122, refreshActivityRow.implicitWidth + 28)
                            onClicked: appController.refreshActivity()
                            background: Rectangle {
                                radius: 10
                                color: !refreshActivityBtn.enabled
                                       ? "#93C5FD"
                                       : (refreshActivityBtn.pressed ? "#1D4ED8" : "#2563EB")
                            }
                            contentItem: Item {
                                Row {
                                    id: refreshActivityRow
                                    anchors.centerIn: parent
                                    spacing: 7
                                    FitIcon {
                                        anchors.verticalCenter: parent.verticalCenter
                                        name: "refresh"
                                        size: 16
                                        color: "#FFFFFF"
                                    }
                                    Label {
                                        anchors.verticalCenter: parent.verticalCenter
                                        text: appController.isSyncingActivity ? qsTr("Syncing...") : qsTr("Refresh")
                                        font.pixelSize: 14
                                        font.weight: Font.DemiBold
                                        color: "#FFFFFF"
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

                            RowLayout {
                                spacing: 6
                                FitIcon { name: "distance"; size: 15; color: "#2563EB" }
                                Label {
                                    text: qsTr("Distance Walked")
                                    font.pixelSize: 12
                                    font.weight: Font.Medium
                                    color: "#64748B"
                                }
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

                            RowLayout {
                                spacing: 6
                                FitIcon { name: "steps"; size: 15; color: "#2563EB" }
                                Label {
                                    text: qsTr("Steps Taken")
                                    font.pixelSize: 12
                                    font.weight: Font.Medium
                                    color: "#64748B"
                                }
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

                            RowLayout {
                                spacing: 6
                                FitIcon { name: "heart"; size: 15; color: "#DC2626" }
                                Label {
                                    text: qsTr("Heart Rate")
                                    font.pixelSize: 12
                                    font.weight: Font.Medium
                                    color: "#64748B"
                                }
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

                            RowLayout {
                                spacing: 6
                                FitIcon { name: "droplet"; size: 15; color: "#16A34A" }
                                Label {
                                    text: qsTr("SpO2")
                                    font.pixelSize: 12
                                    font.weight: Font.Medium
                                    color: "#64748B"
                                }
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

                GridLayout {
                    Layout.fillWidth: true
                    columns: root.isNarrow ? 1 : 2
                    columnSpacing: 12
                    rowSpacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 10

                        Rectangle {
                            width: 34
                            height: 34
                            radius: 9
                            color: "#EFF6FF"
                            FitIcon {
                                anchors.centerIn: parent
                                name: "distance"
                                size: 18
                                color: "#2563EB"
                            }
                        }

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
                    }

                    // Touch-friendly Daily goal stepper control
                    RowLayout {
                        Layout.alignment: root.isNarrow ? Qt.AlignLeft : Qt.AlignRight
                        spacing: 8
                        Label {
                            text: qsTr("Daily goal:")
                            font.pixelSize: 13
                            color: "#64748B"
                        }
                        AbstractButton {
                            id: goalMinusBtn
                            padding: 0
                            implicitWidth: 38
                            implicitHeight: 38
                            onClicked: appController.dailyDistanceGoalMeters = Math.max(1000, appController.dailyDistanceGoalMeters - 500)
                            background: Rectangle {
                                radius: 10
                                color: goalMinusBtn.pressed ? "#E2E8F0" : "#F8FAFC"
                                border.width: 1
                                border.color: "#CBD5E1"
                            }
                            contentItem: Label {
                                text: "-"
                                font.pixelSize: 18
                                font.weight: Font.Bold
                                color: "#0F172A"
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }
                        }
                        Label {
                            text: appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters)
                            font.pixelSize: 14
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                        }
                        AbstractButton {
                            id: goalPlusBtn
                            padding: 0
                            implicitWidth: 38
                            implicitHeight: 38
                            onClicked: appController.dailyDistanceGoalMeters = Math.min(50000, appController.dailyDistanceGoalMeters + 500)
                            background: Rectangle {
                                radius: 10
                                color: goalPlusBtn.pressed ? "#E2E8F0" : "#F8FAFC"
                                border.width: 1
                                border.color: "#CBD5E1"
                            }
                            contentItem: Label {
                                text: "+"
                                font.pixelSize: 18
                                font.weight: Font.Bold
                                color: "#0F172A"
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }
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
                    id: selectedDayFooter
                    Layout.fillWidth: true
                    spacing: 16
                    property var day: root.selectedDayData()

                    Label {
                        text: selectedDayFooter.day.isToday
                              ? qsTr("%1 (%2 · Today)").arg(selectedDayFooter.day.dayFull).arg(selectedDayFooter.day.dateLabel)
                              : qsTr("%1 (%2)").arg(selectedDayFooter.day.dayFull).arg(selectedDayFooter.day.dateLabel)
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                        Layout.fillWidth: true
                    }

                    Label {
                        text: selectedDayFooter.day.hasData
                              ? qsTr("%1 · %2 steps")
                                    .arg(appController.formatDistanceWithUnit(selectedDayFooter.day.distanceMeters))
                                    .arg(selectedDayFooter.day.steps.toLocaleString())
                              : qsTr("No synced distance")
                        font.pixelSize: 13
                        font.weight: Font.Medium
                        color: "#0F172A"
                    }

                    Label {
                        readonly property int pct: Math.round((selectedDayFooter.day.distanceMeters / Math.max(1, appController.dailyDistanceGoalMeters)) * 100)
                        text: !selectedDayFooter.day.hasData
                              ? qsTr("0% of goal")
                              : (selectedDayFooter.day.distanceMeters >= appController.dailyDistanceGoalMeters
                                 ? qsTr("Goal reached (%1%)").arg(pct)
                                 : qsTr("%1 to goal").arg(appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters - selectedDayFooter.day.distanceMeters)))
                        font.pixelSize: 12
                        font.weight: Font.Medium
                        color: (selectedDayFooter.day.hasData && selectedDayFooter.day.distanceMeters >= appController.dailyDistanceGoalMeters) ? "#16A34A" : "#64748B"
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
                        spacing: 10

                        Rectangle {
                            width: 38
                            height: 38
                            radius: 10
                            color: "#FEE2E2"
                            FitIcon {
                                anchors.centerIn: parent
                                name: "heart"
                                size: 20
                                color: "#DC2626"
                            }
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 1
                            Label {
                                text: qsTr("Heart Rate")
                                font.pixelSize: 16
                                font.weight: Font.Bold
                                color: "#0F172A"
                                Layout.fillWidth: true
                                elide: Text.ElideRight
                            }
                            Label {
                                text: appController.heartRateUpdatedAt
                                font.pixelSize: 12
                                color: "#64748B"
                            }
                        }

                        AbstractButton {
                            id: measureHrBtn
                            padding: 0
                            enabled: appController.isConnected && !appController.isMeasuringHeartRate
                            implicitHeight: 42
                            implicitWidth: Math.max(122, measureHrRow.implicitWidth + 28)
                            onClicked: appController.measureHeartRate()
                            background: Rectangle {
                                radius: 10
                                color: measureHrBtn.pressed ? "#B91C1C" : "#DC2626"
                                opacity: measureHrBtn.enabled ? 1.0 : 0.45
                            }
                            contentItem: Item {
                                Row {
                                    id: measureHrRow
                                    anchors.centerIn: parent
                                    spacing: 7
                                    FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "heart"; size: 16; color: "#FFFFFF" }
                                    Label {
                                        anchors.verticalCenter: parent.verticalCenter
                                        text: appController.isMeasuringHeartRate ? qsTr("Measuring...") : qsTr("Measure")
                                        font.pixelSize: 14
                                        font.weight: Font.DemiBold
                                        color: "#FFFFFF"
                                    }
                                }
                            }
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

                // Right Half: SpO2 (Blood Oxygen — Green)
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 10

                        Rectangle {
                            width: 38
                            height: 38
                            radius: 10
                            color: "#DCFCE7"
                            FitIcon {
                                anchors.centerIn: parent
                                name: "droplet"
                                size: 20
                                color: "#16A34A"
                            }
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 1
                            Label {
                                text: qsTr("SpO2")
                                font.pixelSize: 16
                                font.weight: Font.Bold
                                color: "#0F172A"
                                Layout.fillWidth: true
                                elide: Text.ElideRight
                            }
                            Label {
                                text: appController.spo2UpdatedAt
                                font.pixelSize: 12
                                color: "#64748B"
                            }
                        }

                        AbstractButton {
                            id: measureSpo2Btn
                            padding: 0
                            enabled: appController.isConnected && !appController.isMeasuringSpo2
                            implicitHeight: 42
                            implicitWidth: Math.max(122, measureSpo2Row.implicitWidth + 28)
                            onClicked: appController.measureSpo2()
                            background: Rectangle {
                                radius: 10
                                color: measureSpo2Btn.pressed ? "#15803D" : "#16A34A"
                                opacity: measureSpo2Btn.enabled ? 1.0 : 0.45
                            }
                            contentItem: Item {
                                Row {
                                    id: measureSpo2Row
                                    anchors.centerIn: parent
                                    spacing: 7
                                    FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "droplet"; size: 16; color: "#FFFFFF" }
                                    Label {
                                        anchors.verticalCenter: parent.verticalCenter
                                        text: appController.isMeasuringSpo2 ? qsTr("Measuring...") : qsTr("Measure")
                                        font.pixelSize: 14
                                        font.weight: Font.DemiBold
                                        color: "#FFFFFF"
                                    }
                                }
                            }
                        }
                    }

                    RowLayout {
                        spacing: 6
                        Label {
                            text: appController.latestSpo2 > 0 ? String(appController.latestSpo2) : "--"
                            font.pixelSize: 32
                            font.weight: Font.Bold
                            color: appController.latestSpo2 > 0 ? "#16A34A" : "#0F172A"
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

                    // Compact recent SpO2 sample bar strip (Green)
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
                                        color: "#86EFAC"
                                    }
                                }
                            }
                        }

                        Label {
                            anchors.centerIn: parent
                            visible: appController.spo2Samples.length === 0
                            text: qsTr("Recent SpO2 trend appears after reading")
                            font.pixelSize: 12
                            color: "#94A3B8"
                        }
                    }
                }
            }
        }

        // 4. Blood Pressure (BP) Card — Blue (#2563EB)
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: bpCardCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: bpCardCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 12

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 10

                    Rectangle {
                        width: 38
                        height: 38
                        radius: 10
                        color: "#DBEAFE"
                        FitIcon {
                            anchors.centerIn: parent
                            name: "gauge"
                            size: 20
                            color: "#2563EB"
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 1
                        Label {
                            text: qsTr("Blood Pressure")
                            font.pixelSize: 16
                            font.weight: Font.Bold
                            color: "#0F172A"
                            Layout.fillWidth: true
                            elide: Text.ElideRight
                        }
                        Label {
                            text: appController.bloodPressureUpdatedAt
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                    }

                    AbstractButton {
                        id: measureBpBtn
                        padding: 0
                        enabled: appController.isConnected && !appController.isMeasuringBloodPressure
                        implicitHeight: 42
                        implicitWidth: Math.max(122, measureBpRow.implicitWidth + 28)
                        onClicked: appController.measureBloodPressure()
                        background: Rectangle {
                            radius: 10
                            color: measureBpBtn.pressed ? "#1D4ED8" : "#2563EB"
                            opacity: measureBpBtn.enabled ? 1.0 : 0.45
                        }
                        contentItem: Item {
                            Row {
                                id: measureBpRow
                                anchors.centerIn: parent
                                spacing: 7
                                FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "gauge"; size: 16; color: "#FFFFFF" }
                                Label {
                                    anchors.verticalCenter: parent.verticalCenter
                                    text: appController.isMeasuringBloodPressure ? qsTr("Measuring...") : qsTr("Measure")
                                    font.pixelSize: 14
                                    font.weight: Font.DemiBold
                                    color: "#FFFFFF"
                                }
                            }
                        }
                    }
                }

                RowLayout {
                    spacing: 8
                    Label {
                        text: (appController.latestSystolic > 0 && appController.latestDiastolic > 0)
                              ? qsTr("%1/%2").arg(appController.latestSystolic).arg(appController.latestDiastolic)
                              : "--/--"
                        font.pixelSize: 32
                        font.weight: Font.Bold
                        color: (appController.latestSystolic > 0 && appController.latestDiastolic > 0) ? "#2563EB" : "#0F172A"
                    }
                    Label {
                        text: "mmHg"
                        font.pixelSize: 14
                        font.weight: Font.Medium
                        color: "#64748B"
                        Layout.alignment: Qt.AlignBottom
                        Layout.bottomMargin: 4
                    }
                    Item { Layout.fillWidth: true }
                    Label {
                        text: root.bpStatusText()
                        font.pixelSize: 12
                        font.weight: Font.Medium
                        color: (appController.latestSystolic <= 0) ? "#64748B"
                               : ((appController.latestSystolic < 120 && appController.latestDiastolic < 80) ? "#16A34A"
                               : (appController.latestSystolic < 130 ? "#D97706" : "#DC2626"))
                    }
                }

                Label {
                    text: root.bpStatsText()
                    font.pixelSize: 12
                    color: "#64748B"
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }

                // Compact recent Blood Pressure sample bar strip (Blue)
                Item {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 56

                    RowLayout {
                        anchors.fill: parent
                        spacing: 4
                        visible: appController.bloodPressureSamples.length > 0

                        Repeater {
                            model: appController.bloodPressureSamples
                            delegate: Item {
                                required property var modelData
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                readonly property real normSys: Math.max(0.2, Math.min(1.0, (Number(modelData.systolic) - 70) / 110.0))

                                Rectangle {
                                    anchors.bottom: parent.bottom
                                    anchors.left: parent.left
                                    anchors.right: parent.right
                                    height: parent.height * normSys
                                    radius: 3
                                    color: "#93C5FD"
                                }
                            }
                        }
                    }

                    Label {
                        anchors.centerIn: parent
                        visible: appController.bloodPressureSamples.length === 0
                        text: qsTr("Recent BP trend appears after reading")
                        font.pixelSize: 12
                        color: "#94A3B8"
                    }
                }
            }
        }

        Item { Layout.preferredHeight: 24 }
    }
}
