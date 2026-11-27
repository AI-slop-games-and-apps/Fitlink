import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import FitLink

ScrollView {
    id: root
    contentWidth: availableWidth
    clip: true

    signal openActivityRequested()

    ColumnLayout {
        width: root.availableWidth < 540 ? root.availableWidth - 24 : Math.min(root.availableWidth - 48, 960)
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: 20
        spacing: 18

        // Watch Connection & Battery Summary Card
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: summaryCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: summaryCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 16

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 16

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 4
                        Label {
                            text: appController.isConnected ? appController.deviceName : qsTr("No Watch Connected")
                            font.pixelSize: 24
                            font.weight: Font.Bold
                            color: "#0F172A"
                            wrapMode: Text.WordWrap
                            Layout.fillWidth: true
                        }
                        Label {
                            text: appController.isConnected
                                  ? qsTr("%1 · %2 · %3")
                                        .arg(appController.connectionStateText)
                                        .arg(appController.activeProtocolLabel)
                                        .arg(appController.deviceAddress)
                                  : qsTr("Pair a 0xFEEA BLE watch to sync time and push alerts.")
                            font.pixelSize: 13
                            color: appController.isConnected ? "#16A34A" : "#64748B"
                            wrapMode: Text.WordWrap
                            Layout.fillWidth: true
                        }
                    }

                    ColumnLayout {
                        Layout.alignment: Qt.AlignRight | Qt.AlignVCenter
                        spacing: 2
                        Label {
                            text: appController.batteryLevel >= 0 ? appController.batteryLevel + "%" : "--%"
                            font.pixelSize: 28
                            font.weight: Font.Bold
                            color: appController.batteryLevel >= 0 && appController.batteryLevel <= 20 ? "#D97706" : "#0F172A"
                            Layout.alignment: Qt.AlignRight
                        }
                        RowLayout {
                            Layout.alignment: Qt.AlignRight
                            spacing: 4
                            Label {
                                text: qsTr("Battery")
                                font.pixelSize: 12
                                color: "#64748B"
                            }
                            AbstractButton {
                                id: refreshBattBtn
                                visible: appController.isConnected
                                padding: 0
                                implicitWidth: 22
                                implicitHeight: 22
                                onClicked: appController.refreshBattery()
                                background: Rectangle {
                                    radius: 6
                                    color: refreshBattBtn.pressed ? "#E2E8F0" : (refreshBattBtn.hovered ? "#F1F5F9" : "transparent")
                                }
                                contentItem: Item {
                                    FitIcon {
                                        anchors.centerIn: parent
                                        name: "refresh"
                                        size: 12
                                        color: "#64748B"
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

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 10

                    AbstractButton {
                        id: syncTimeBtn
                        padding: 0
                        enabled: appController.isConnected
                        Layout.fillWidth: root.availableWidth < 540
                        Layout.preferredWidth: root.availableWidth < 540 ? 1 : syncTimeRow.implicitWidth + 32
                        implicitHeight: 42
                        onClicked: appController.syncTimeNow()
                        background: Rectangle {
                            radius: 10
                            color: !syncTimeBtn.enabled ? "#93C5FD" : (syncTimeBtn.pressed ? "#1D4ED8" : "#2563EB")
                        }
                        contentItem: Item {
                            Row {
                                id: syncTimeRow
                                anchors.centerIn: parent
                                spacing: 7
                                FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "time"; size: 16; color: "#FFFFFF" }
                                Label {
                                    anchors.verticalCenter: parent.verticalCenter
                                    text: qsTr("Sync Time")
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                    color: "#FFFFFF"
                                }
                            }
                        }
                    }

                    AbstractButton {
                        id: findWatchBtn
                        padding: 0
                        enabled: appController.isConnected
                        Layout.fillWidth: root.availableWidth < 540
                        Layout.preferredWidth: root.availableWidth < 540 ? 1 : findWatchRow.implicitWidth + 32
                        implicitHeight: 42
                        onClicked: appController.triggerFindWatch()
                        background: Rectangle {
                            radius: 10
                            color: findWatchBtn.pressed ? "#E2E8F0" : "#F1F5F9"
                            opacity: findWatchBtn.enabled ? 1.0 : 0.5
                        }
                        contentItem: Item {
                            Row {
                                id: findWatchRow
                                anchors.centerIn: parent
                                spacing: 7
                                FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "find"; size: 16; color: "#0F172A" }
                                Label {
                                    anchors.verticalCenter: parent.verticalCenter
                                    text: qsTr("Find Watch")
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                    color: "#0F172A"
                                }
                            }
                        }
                    }

                    Item {
                        visible: root.availableWidth >= 540
                        Layout.fillWidth: true
                    }
                }
            }
        }

        // Today's Activity Card (same size as status cards below, directly above Last Time Sync)
        GridLayout {
            Layout.fillWidth: true
            columns: root.width < 680 ? 1 : 3
            columnSpacing: 16
            rowSpacing: 16

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredWidth: 1
                implicitHeight: 112
                radius: 14
                color: "#FFFFFF"
                border.color: "#E2E8F0"
                border.width: 1

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.openActivityRequested()
                }

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 18
                    spacing: 6

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 6
                        FitIcon { name: "activity"; size: 15; color: "#2563EB" }
                        Label {
                            text: qsTr("Today's Activity")
                            font.pixelSize: 12
                            color: "#64748B"
                            Layout.fillWidth: true
                        }
                        AbstractButton {
                            id: refreshActivityBtn
                            padding: 0
                            enabled: appController.isConnected && !appController.isSyncingActivity
                            implicitWidth: 24
                            implicitHeight: 24
                            onClicked: appController.refreshActivity()
                            background: Rectangle {
                                radius: 6
                                color: refreshActivityBtn.pressed ? "#E2E8F0" : (refreshActivityBtn.hovered ? "#F1F5F9" : "transparent")
                                opacity: refreshActivityBtn.enabled ? 1.0 : 0.4
                            }
                            contentItem: Item {
                                FitIcon {
                                    anchors.centerIn: parent
                                    name: "refresh"
                                    size: 13
                                    color: "#64748B"
                                }
                            }
                        }
                    }

                    Label {
                        text: (appController.todaySteps >= 0 ? appController.todaySteps.toLocaleString() : "--")
                              + qsTr(" steps · ")
                              + (appController.todayDistanceMeters >= 0
                                 ? appController.formatDistanceWithUnit(appController.todayDistanceMeters)
                                 : "-- " + appController.distanceUnit)
                        font.pixelSize: 15
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }

                    Label {
                        text: qsTr("Daily goal: %1").arg(appController.formatDistanceWithUnit(appController.dailyDistanceGoalMeters))
                        font.pixelSize: 12
                        color: "#64748B"
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }
            }

            Item {
                visible: root.width >= 680
                Layout.fillWidth: true
                Layout.preferredWidth: 1
            }

            Item {
                visible: root.width >= 680
                Layout.fillWidth: true
                Layout.preferredWidth: 1
            }
        }

        // Quick Status Row
        GridLayout {
            Layout.fillWidth: true
            columns: root.width < 680 ? 1 : 3
            columnSpacing: 16
            rowSpacing: 16

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 112
                radius: 14
                color: "#FFFFFF"
                border.color: "#E2E8F0"
                border.width: 1

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 18
                    spacing: 6
                    RowLayout {
                        spacing: 6
                        FitIcon { name: "time"; size: 15; color: "#2563EB" }
                        Label { text: qsTr("Last Time Sync"); font.pixelSize: 12; color: "#64748B" }
                    }
                    Label {
                        text: appController.lastSyncedTime
                        font.pixelSize: 15
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                    Label {
                        text: appController.use24Hour ? qsTr("24-hour · Auto-sync %1").arg(appController.autoSyncOnConnect ? qsTr("On") : qsTr("Off"))
                                                      : qsTr("12-hour · Auto-sync %1").arg(appController.autoSyncOnConnect ? qsTr("On") : qsTr("Off"))
                        font.pixelSize: 12
                        color: "#64748B"
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 112
                radius: 14
                color: "#FFFFFF"
                border.color: "#E2E8F0"
                border.width: 1

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 18
                    spacing: 6
                    RowLayout {
                        spacing: 6
                        FitIcon { name: "alerts"; size: 15; color: "#2563EB" }
                        Label { text: qsTr("OS Notification Mirror"); font.pixelSize: 12; color: "#64748B" }
                    }
                    Label {
                        text: appController.osMirroringEnabled ? qsTr("Mirroring Active") : qsTr("Mirroring Paused")
                        font.pixelSize: 15
                        font.weight: Font.DemiBold
                        color: appController.osMirroringEnabled ? "#16A34A" : "#0F172A"
                    }
                    Label {
                        text: appController.osBridgePlatform
                        font.pixelSize: 12
                        color: "#64748B"
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 112
                radius: 14
                color: "#FFFFFF"
                border.color: "#E2E8F0"
                border.width: 1

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 18
                    spacing: 6
                    RowLayout {
                        spacing: 6
                        FitIcon { name: "calendar"; size: 15; color: "#2563EB" }
                        Label { text: qsTr("Scheduled Alerts"); font.pixelSize: 12; color: "#64748B" }
                    }
                    Label {
                        text: qsTr("%1 configured").arg(appController.scheduledAlerts.length)
                        font.pixelSize: 15
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                    }
                    Label {
                        text: qsTr("Local timer active while app runs")
                        font.pixelSize: 12
                        color: "#64748B"
                    }
                }
            }
        }

        // Recent BLE Activity
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: Math.max(160, recentCol.implicitHeight + 40)
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: recentCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 12

                Label {
                    text: qsTr("Recent Watch Commands")
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                    color: "#0F172A"
                }

                Label {
                    visible: appController.packetLog.length === 0
                    text: qsTr("No commands sent yet. Pair a watch and sync time or send a test notification.")
                    font.pixelSize: 13
                    color: "#64748B"
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }

                Repeater {
                    model: appController.packetLog.slice(0, 5)
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 12
                        Label {
                            text: modelData.timestamp
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                        Label {
                            text: modelData.actionLabel
                            font.pixelSize: 13
                            font.weight: Font.Medium
                            color: "#0F172A"
                            Layout.fillWidth: true
                        }
                        Label {
                            text: modelData.protocolLabel
                            font.pixelSize: 12
                            color: "#475569"
                        }
                    }
                }
            }
        }

        Item { Layout.preferredHeight: 24 }
    }
}
