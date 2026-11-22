import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

ScrollView {
    id: root
    contentWidth: availableWidth
    clip: true

    ColumnLayout {
        width: Math.min(root.availableWidth - 48, 960)
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: 24
        spacing: 20

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
                            font.pixelSize: 20
                            font.weight: Font.Bold
                            color: "#0F172A"
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
                        Label {
                            text: qsTr("Battery")
                            font.pixelSize: 12
                            color: "#64748B"
                            Layout.alignment: Qt.AlignRight
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    height: 1
                    color: "#E2E8F0"
                }

                Flow {
                    Layout.fillWidth: true
                    spacing: 12

                    Button {
                        text: qsTr("Sync Time Now")
                        highlighted: true
                        enabled: appController.isConnected
                        onClicked: appController.syncTimeNow()
                    }
                    Button {
                        text: qsTr("Find Watch")
                        enabled: appController.isConnected
                        onClicked: appController.triggerFindWatch()
                    }
                    Button {
                        text: qsTr("Refresh Battery")
                        flat: true
                        enabled: appController.isConnected
                        onClicked: appController.refreshBattery()
                    }
                }
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
                    Label { text: qsTr("Last Time Sync"); font.pixelSize: 12; color: "#64748B" }
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
                    Label { text: qsTr("OS Notification Mirror"); font.pixelSize: 12; color: "#64748B" }
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
                    Label { text: qsTr("Scheduled Alerts"); font.pixelSize: 12; color: "#64748B" }
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
