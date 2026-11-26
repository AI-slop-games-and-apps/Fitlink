import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

ColumnLayout {
    id: root
    spacing: 0

    readonly property var appIcons: [
        { id: 0,  label: "Incoming Call" },
        { id: 1,  label: "SMS" },
        { id: 6,  label: "WhatsApp" },
        { id: 12, label: "Telegram" },
        { id: 11, label: "Gmail" },
        { id: 14, label: "Calendar" },
        { id: 13, label: "Slack" },
        { id: 8,  label: "Instagram" },
        { id: 15, label: "Generic App" }
    ]

    readonly property var formatOptions: [
        "0x64 Standard UTF-8 (Default)",
        "0x64 Null-Terminated UTF-8",
        "0x64 V2 Flag Header [icon, 0x00, text]",
        "0x64 Split Title / Body",
        "0x64 Length-Prefixed UTF-8",
        "0x64 UTF-16LE Unicode"
    ]

    TabBar {
        id: subTabs
        Layout.fillWidth: true
        background: Rectangle { color: "#FFFFFF" }

        TabButton { text: qsTr("OS Mirroring") }
        TabButton { text: qsTr("Manual Composer") }
        TabButton { text: qsTr("Scheduled Alerts") }
    }

    Rectangle { Layout.fillWidth: true; height: 1; color: "#E2E8F0" }

    StackLayout {
        Layout.fillWidth: true
        Layout.fillHeight: true
        currentIndex: subTabs.currentIndex

        // TAB 1: OS Notification Mirroring (Linux D-Bus / Android NotificationListenerService)
        ScrollView {
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: Math.min(parent.width - 48, 860)
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.top: parent.top
                anchors.topMargin: 24
                spacing: 20

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: mirrorCard.implicitHeight + 40
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: mirrorCard
                        anchors.fill: parent
                        anchors.margins: 20
                        spacing: 14

                        RowLayout {
                            Layout.fillWidth: true
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2
                                Label { text: qsTr("Mirror System Notifications"); font.pixelSize: 16; font.weight: Font.DemiBold; color: "#0F172A" }
                                Label { text: appController.osBridgePlatform; font.pixelSize: 12; color: "#64748B" }
                            }
                            Switch {
                                checked: appController.osMirroringEnabled
                                enabled: appController.osBridgeAvailable
                                onToggled: appController.osMirroringEnabled = checked
                            }
                        }

                        RowLayout {
                            visible: appController.osBridgeAvailable && !appController.osBridgeHasPermission
                            Layout.fillWidth: true
                            spacing: 12
                            Label {
                                text: qsTr("Notification access permission is required on Android to mirror system alerts.")
                                color: "#D97706"
                                font.pixelSize: 13
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                            }
                            Button {
                                text: qsTr("Open Settings")
                                highlighted: true
                                onClicked: appController.openOsNotificationSettings()
                            }
                            Button {
                                text: qsTr("Recheck")
                                flat: true
                                onClicked: appController.refreshOsNotificationPermission()
                            }
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: filterCol.implicitHeight + 40
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: filterCol
                        anchors.fill: parent
                        anchors.margins: 20
                        spacing: 10

                        Label {
                            text: qsTr("Per-App Mirroring Filters")
                            font.pixelSize: 15
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                        }

                        Repeater {
                            model: appController.appFilters
                            delegate: RowLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                Label {
                                    text: modelData.displayName
                                    font.pixelSize: 14
                                    color: "#0F172A"
                                    Layout.fillWidth: true
                                }
                                Switch {
                                    checked: modelData.enabled
                                    onToggled: appController.toggleAppFilter(modelData.appId, checked)
                                }
                            }
                        }
                    }
                }

                Item { Layout.preferredHeight: 24 }
            }
        }

        // TAB 2: Manual Notification Composer & Saved Templates
        ScrollView {
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: Math.min(parent.width - 48, 860)
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.top: parent.top
                anchors.topMargin: 24
                spacing: 20

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: composerCol.implicitHeight + 40
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: composerCol
                        anchors.fill: parent
                        anchors.margins: 20
                        spacing: 14

                        Label {
                            text: qsTr("Compose Watch Notification")
                            font.pixelSize: 16
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                        }

                        ComboBox {
                            id: iconSelector
                            Layout.fillWidth: true
                            textRole: "label"
                            model: root.appIcons
                            currentIndex: 1 // SMS default
                        }

                        TextField {
                            id: titleInput
                            Layout.fillWidth: true
                            placeholderText: qsTr("Sender or Title")
                        }

                        TextArea {
                            id: bodyInput
                            Layout.fillWidth: true
                            Layout.preferredHeight: 96
                            placeholderText: qsTr("Message body...")
                            wrapMode: TextArea.Wrap
                        }

                        ComboBox {
                            id: formatSelector
                            Layout.fillWidth: true
                            model: root.formatOptions
                            currentIndex: appController.notificationFormat
                            onActivated: function(index) {
                                appController.notificationFormat = index
                            }
                        }

                        Label {
                            text: qsTr("%1 / 128 UTF-8 bytes · %2 BLE chunk(s)")
                                  .arg(appController.utf8ByteLength(titleInput.text, bodyInput.text))
                                  .arg(appController.estimatedChunkCount(titleInput.text, bodyInput.text))
                            font.pixelSize: 12
                            color: "#64748B"
                        }

                        Flow {
                            Layout.fillWidth: true
                            spacing: 10
                            Button {
                                text: qsTr("Send to Watch")
                                highlighted: true
                                enabled: appController.isConnected
                                onClicked: {
                                    var iconId = root.appIcons[iconSelector.currentIndex].id
                                    appController.sendManualNotification(iconId, titleInput.text, bodyInput.text)
                                }
                            }
                            Button {
                                text: qsTr("Send Quick Test")
                                enabled: appController.isConnected
                                onClicked: appController.sendManualNotification(1, "FitLink", "Hi")
                            }
                            Button {
                                text: qsTr("Test All Formats")
                                enabled: appController.isConnected
                                onClicked: {
                                    var iconId = root.appIcons[iconSelector.currentIndex].id
                                    appController.testAllNotificationFormats(iconId, titleInput.text, bodyInput.text)
                                }
                            }
                            Button {
                                text: qsTr("Save Template")
                                onClicked: {
                                    var iconId = root.appIcons[iconSelector.currentIndex].id
                                    appController.saveTemplate(iconId, titleInput.text, bodyInput.text)
                                }
                            }
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: tplCol.implicitHeight + 40
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: tplCol
                        anchors.fill: parent
                        anchors.margins: 20
                        spacing: 10

                        Label {
                            text: qsTr("Saved Templates")
                            font.pixelSize: 15
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                        }

                        Repeater {
                            model: appController.templates
                            delegate: RowLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                spacing: 10

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2
                                    Label { text: modelData.title; font.weight: Font.Medium; color: "#0F172A" }
                                    Label { text: modelData.body; font.pixelSize: 12; color: "#64748B"; elide: Text.ElideRight; Layout.fillWidth: true }
                                }
                                Button {
                                    text: qsTr("Send")
                                    flat: true
                                    enabled: appController.isConnected
                                    onClicked: appController.sendManualNotification(modelData.iconId, modelData.title, modelData.body)
                                }
                                Button {
                                    text: qsTr("Remove")
                                    flat: true
                                    onClicked: appController.deleteTemplate(modelData.id)
                                }
                            }
                        }
                    }
                }

                Item { Layout.preferredHeight: 24 }
            }
        }

        // TAB 3: Scheduled Alerts
        ScrollView {
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: Math.min(parent.width - 48, 860)
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.top: parent.top
                anchors.topMargin: 24
                spacing: 20

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: schedForm.implicitHeight + 40
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: schedForm
                        anchors.fill: parent
                        anchors.margins: 20
                        spacing: 12

                        Label { text: qsTr("Add Scheduled Alert"); font.pixelSize: 16; font.weight: Font.DemiBold; color: "#0F172A" }

                        TextField { id: schedTitle; Layout.fillWidth: true; placeholderText: qsTr("Reminder title (e.g. Stretch Break)") }
                        TextField { id: schedBody; Layout.fillWidth: true; placeholderText: qsTr("Reminder message") }

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 12
                            ComboBox {
                                id: schedMode
                                model: ["once", "interval"]
                            }
                            TextField {
                                id: schedTime
                                visible: schedMode.currentText === "once"
                                placeholderText: "HH:mm"
                                text: "09:00"
                                Layout.fillWidth: true
                            }
                            SpinBox {
                                id: schedInterval
                                visible: schedMode.currentText === "interval"
                                from: 1
                                to: 720
                                value: 45
                                Layout.fillWidth: true
                            }
                        }

                        Button {
                            text: qsTr("Add Schedule")
                            highlighted: true
                            onClicked: {
                                appController.addScheduledAlert(14, schedTitle.text, schedBody.text, schedMode.currentText, schedTime.text, schedInterval.value)
                                schedTitle.text = ""
                                schedBody.text = ""
                            }
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: schedListCol.implicitHeight + 40
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: schedListCol
                        anchors.fill: parent
                        anchors.margins: 20
                        spacing: 10

                        Label { text: qsTr("Active Schedules"); font.pixelSize: 15; font.weight: Font.DemiBold; color: "#0F172A" }

                        Label {
                            visible: appController.scheduledAlerts.length === 0
                            text: qsTr("No scheduled alerts yet. Create a reminder above to push alerts automatically.")
                            font.pixelSize: 13
                            color: "#64748B"
                        }

                        Repeater {
                            model: appController.scheduledAlerts
                            delegate: RowLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                spacing: 10

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2
                                    Label { text: modelData.title; font.weight: Font.Medium; color: "#0F172A" }
                                    Label {
                                        text: modelData.mode === "interval"
                                              ? qsTr("Every %1 min · %2").arg(modelData.intervalMinutes).arg(modelData.body)
                                              : qsTr("At %1 · %2").arg(modelData.targetTime).arg(modelData.body)
                                        font.pixelSize: 12
                                        color: "#64748B"
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                }

                                Switch {
                                    checked: modelData.enabled
                                    onToggled: appController.toggleScheduledAlert(modelData.id, checked)
                                }
                                Button {
                                    text: qsTr("Send Now")
                                    flat: true
                                    enabled: appController.isConnected
                                    onClicked: appController.fireScheduledAlertNow(modelData.id)
                                }
                                Button {
                                    text: qsTr("Delete")
                                    flat: true
                                    onClicked: appController.deleteScheduledAlert(modelData.id)
                                }
                            }
                        }
                    }
                }

                Item { Layout.preferredHeight: 24 }
            }
        }
    }
}
