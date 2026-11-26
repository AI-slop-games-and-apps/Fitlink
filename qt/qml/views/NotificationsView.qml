import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import FitLink

ColumnLayout {
    id: root
    spacing: 0

    readonly property var appIcons: [
        { id: 0,   label: "Incoming Call (0x00)" },
        { id: 1,   label: "SMS (0x01)" },
        { id: 6,   label: "WhatsApp (0x06)" },
        { id: 12,  label: "Telegram (0x0C)" },
        { id: 11,  label: "Gmail (0x0B)" },
        { id: 14,  label: "Calendar (0x0E)" },
        { id: 13,  label: "Slack (0x0D)" },
        { id: 8,   label: "Instagram (0x08)" },
        { id: 15,  label: "Generic App (0x0F)" },
        { id: 255, label: "All / Other (0xFF)" }
    ]

    readonly property var formatOptions: [
        "1. 0x64 Standard UTF-8 [icon, text]",
        "2. 0x64 V2 Version [icon, 0x01, text]",
        "3. 0x64 V2 Flag [icon, 0x00, text]",
        "4. 0x64 Split Length [icon, tLen, title, bLen, body]",
        "5. 0x64 Split NUL [icon, title, 0x00, body, 0x00]",
        "6. 0x64 Null-Terminated [icon, text, 0x00]",
        "7. 0x64 Length-Prefixed [icon, len, text]",
        "8. 0x64 UTF-16LE [icon, utf16le]"
    ]

    TabBar {
        id: subTabs
        Layout.fillWidth: true
        background: Rectangle { color: "#FFFFFF" }

        TabButton { text: qsTr("Manual Composer") }
        TabButton { text: qsTr("Scheduled Alerts") }
        TabButton { text: qsTr("OS Mirroring") }
    }

    Rectangle { Layout.fillWidth: true; height: 1; color: "#E2E8F0" }

    StackLayout {
        Layout.fillWidth: true
        Layout.fillHeight: true
        currentIndex: subTabs.currentIndex

        // TAB 1: Manual Notification Composer & Saved Templates
        ScrollView {
            id: composerScroll
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: composerScroll.availableWidth < 540
                       ? composerScroll.availableWidth - 24
                       : Math.min(composerScroll.availableWidth - 48, 860)
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.top: parent.top
                anchors.topMargin: 20
                spacing: 18

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: composerCol.implicitHeight + 36
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: composerCol
                        anchors.fill: parent
                        anchors.margins: 18
                        spacing: 14

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
                                    name: "alerts"
                                    size: 18
                                    color: "#2563EB"
                                }
                            }

                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 1
                                Label {
                                    text: qsTr("Compose Watch Notification")
                                    font.pixelSize: 16
                                    font.weight: Font.Bold
                                    color: "#0F172A"
                                    Layout.fillWidth: true
                                    elide: Text.ElideRight
                                }
                                Label {
                                    text: qsTr("%1 · %2B MTU · %3 · ANS %4")
                                          .arg(appController.activeProtocolLabel)
                                          .arg(appController.mtuSize)
                                          .arg(appController.preferWriteNoResponse ? "WNR" : "WWR")
                                          .arg(appController.hasAlertNotificationService ? "0x1811" : "Off")
                                    font.pixelSize: 11
                                    color: "#64748B"
                                    Layout.fillWidth: true
                                    elide: Text.ElideRight
                                }
                            }
                        }

                        ComboBox {
                            id: iconSelector
                            Layout.fillWidth: true
                            textRole: "label"
                            model: root.appIcons
                            currentIndex: 1 // SMS (0x01) default
                        }

                        TextField {
                            id: titleInput
                            Layout.fillWidth: true
                            placeholderText: qsTr("Sender or Title")
                        }

                        TextArea {
                            id: bodyInput
                            Layout.fillWidth: true
                            Layout.preferredHeight: 88
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

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 10
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 1
                                Label {
                                    text: qsTr("Write Without Response (0xFEE2)")
                                    font.pixelSize: 13
                                    font.weight: Font.Medium
                                    color: "#0F172A"
                                }
                                Label {
                                    text: qsTr("Toggle if watch ignores acknowledged notification writes")
                                    font.pixelSize: 11
                                    color: "#64748B"
                                    wrapMode: Text.WordWrap
                                    Layout.fillWidth: true
                                }
                            }
                            Switch {
                                checked: appController.preferWriteNoResponse
                                onToggled: appController.preferWriteNoResponse = checked
                            }
                        }

                        Label {
                            text: qsTr("%1 / 128 UTF-8 bytes · %2 BLE chunk(s) at %3B MTU")
                                  .arg(appController.utf8ByteLength(titleInput.text, bodyInput.text))
                                  .arg(appController.estimatedChunkCount(titleInput.text, bodyInput.text))
                                  .arg(appController.mtuSize)
                            font.pixelSize: 12
                            color: "#64748B"
                        }

                        Flow {
                            Layout.fillWidth: true
                            spacing: 10

                            AbstractButton {
                                id: sendNotifBtn
                                padding: 0
                                enabled: appController.isConnected
                                implicitHeight: 44
                                implicitWidth: Math.max(144, sendNotifRow.implicitWidth + 28)
                                onClicked: {
                                    var iconId = root.appIcons[iconSelector.currentIndex].id
                                    appController.sendManualNotification(iconId, titleInput.text, bodyInput.text)
                                }
                                background: Rectangle {
                                    radius: 10
                                    color: !sendNotifBtn.enabled ? "#93C5FD" : (sendNotifBtn.pressed ? "#1D4ED8" : "#2563EB")
                                }
                                contentItem: Item {
                                    Row {
                                        id: sendNotifRow
                                        anchors.centerIn: parent
                                        spacing: 7
                                        FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "alerts"; size: 16; color: "#FFFFFF" }
                                        Label {
                                            anchors.verticalCenter: parent.verticalCenter
                                            text: qsTr("Send to Watch")
                                            font.pixelSize: 14
                                            font.weight: Font.DemiBold
                                            color: "#FFFFFF"
                                        }
                                    }
                                }
                            }

                            AbstractButton {
                                id: quickTestBtn
                                padding: 0
                                enabled: appController.isConnected
                                implicitHeight: 44
                                implicitWidth: Math.max(128, quickTestRow.implicitWidth + 26)
                                onClicked: appController.sendManualNotification(1, "FitLink", "Hi")
                                background: Rectangle {
                                    radius: 10
                                    color: quickTestBtn.pressed ? "#DBEAFE" : "#EFF6FF"
                                    border.width: 1
                                    border.color: "#BFDBFE"
                                    opacity: quickTestBtn.enabled ? 1.0 : 0.45
                                }
                                contentItem: Item {
                                    Row {
                                        id: quickTestRow
                                        anchors.centerIn: parent
                                        spacing: 7
                                        FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "alerts"; size: 15; color: "#2563EB" }
                                        Label {
                                            anchors.verticalCenter: parent.verticalCenter
                                            text: qsTr("Quick Test")
                                            font.pixelSize: 14
                                            font.weight: Font.DemiBold
                                            color: "#2563EB"
                                        }
                                    }
                                }
                            }

                            AbstractButton {
                                id: callAlertBtn
                                padding: 0
                                enabled: appController.isConnected
                                implicitHeight: 44
                                implicitWidth: Math.max(142, callAlertRow.implicitWidth + 26)
                                onClicked: appController.sendManualNotification(0, "FitLink", "Test Call")
                                background: Rectangle {
                                    radius: 10
                                    color: callAlertBtn.pressed ? "#DCFCE7" : "#F0FDF4"
                                    border.width: 1
                                    border.color: "#BBF7D0"
                                    opacity: callAlertBtn.enabled ? 1.0 : 0.45
                                }
                                contentItem: Item {
                                    Row {
                                        id: callAlertRow
                                        anchors.centerIn: parent
                                        spacing: 7
                                        FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "find"; size: 15; color: "#15803D" }
                                        Label {
                                            anchors.verticalCenter: parent.verticalCenter
                                            text: qsTr("Call Alert (0x00)")
                                            font.pixelSize: 13
                                            font.weight: Font.DemiBold
                                            color: "#15803D"
                                        }
                                    }
                                }
                            }

                            AbstractButton {
                                id: testAllBtn
                                padding: 0
                                enabled: appController.isConnected
                                implicitHeight: 44
                                implicitWidth: Math.max(166, testAllRow.implicitWidth + 26)
                                onClicked: {
                                    var iconId = root.appIcons[iconSelector.currentIndex].id
                                    appController.testAllNotificationFormats(iconId, titleInput.text, bodyInput.text)
                                }
                                background: Rectangle {
                                    radius: 10
                                    color: testAllBtn.pressed ? "#E2E8F0" : "#F8FAFC"
                                    border.width: 1
                                    border.color: "#CBD5E1"
                                    opacity: testAllBtn.enabled ? 1.0 : 0.45
                                }
                                contentItem: Item {
                                    Row {
                                        id: testAllRow
                                        anchors.centerIn: parent
                                        spacing: 7
                                        FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "refresh"; size: 15; color: "#0F172A" }
                                        Label {
                                            anchors.verticalCenter: parent.verticalCenter
                                            text: qsTr("Test All Formats (1–8)")
                                            font.pixelSize: 13
                                            font.weight: Font.DemiBold
                                            color: "#0F172A"
                                        }
                                    }
                                }
                            }

                            AbstractButton {
                                id: saveTplBtn
                                padding: 0
                                implicitHeight: 44
                                implicitWidth: Math.max(128, saveTplRow.implicitWidth + 24)
                                onClicked: {
                                    var iconId = root.appIcons[iconSelector.currentIndex].id
                                    appController.saveTemplate(iconId, titleInput.text, bodyInput.text)
                                }
                                background: Rectangle {
                                    radius: 10
                                    color: saveTplBtn.pressed ? "#E2E8F0" : "#FFFFFF"
                                    border.width: 1
                                    border.color: "#CBD5E1"
                                }
                                contentItem: Item {
                                    Row {
                                        id: saveTplRow
                                        anchors.centerIn: parent
                                        spacing: 6
                                        FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "calendar"; size: 15; color: "#475569" }
                                        Label {
                                            anchors.verticalCenter: parent.verticalCenter
                                            text: qsTr("Save Template")
                                            font.pixelSize: 13
                                            font.weight: Font.Medium
                                            color: "#0F172A"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Live TX/RX Packet Feedback right inside Manual Composer
                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: recentNotifLogCol.implicitHeight + 32
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: recentNotifLogCol
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 8

                        Label {
                            text: qsTr("Recent BLE Packets")
                            font.pixelSize: 14
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                        }

                        Label {
                            visible: appController.packetLog.length === 0
                            text: qsTr("Connect watch and send a test to inspect exact TX/RX hex.")
                            font.pixelSize: 12
                            color: "#64748B"
                            wrapMode: Text.WordWrap
                            Layout.fillWidth: true
                        }

                        Repeater {
                            model: Math.min(4, appController.packetLog.length)
                            delegate: ColumnLayout {
                                required property int index
                                property var entry: appController.packetLog[index]
                                Layout.fillWidth: true
                                spacing: 2

                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 8
                                    Label {
                                        text: entry ? (entry.direction.toUpperCase() + " " + entry.timestamp) : ""
                                        font.pixelSize: 11
                                        font.weight: Font.Bold
                                        font.family: "monospace"
                                        color: entry && entry.direction === "rx"
                                               ? "#16A34A"
                                               : (entry && entry.status === "error" ? "#DC2626" : "#2563EB")
                                    }
                                    Label {
                                        text: entry ? entry.actionLabel : ""
                                        font.pixelSize: 12
                                        font.weight: Font.Medium
                                        color: "#0F172A"
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                }
                                Label {
                                    text: entry ? entry.hexPreview : ""
                                    font.pixelSize: 11
                                    font.family: "monospace"
                                    color: "#475569"
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                            }
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: tplCol.implicitHeight + 36
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: tplCol
                        anchors.fill: parent
                        anchors.margins: 18
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
                                spacing: 8

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2
                                    Label { text: modelData.title; font.weight: Font.Medium; color: "#0F172A"; elide: Text.ElideRight; Layout.fillWidth: true }
                                    Label { text: modelData.body; font.pixelSize: 12; color: "#64748B"; elide: Text.ElideRight; Layout.fillWidth: true }
                                }
                                AbstractButton {
                                    padding: 0
                                    enabled: appController.isConnected
                                    implicitHeight: 36
                                    implicitWidth: 64
                                    onClicked: appController.sendManualNotification(modelData.iconId, modelData.title, modelData.body)
                                    background: Rectangle {
                                        radius: 8
                                        color: "#EFF6FF"
                                        opacity: parent.enabled ? 1.0 : 0.45
                                    }
                                    contentItem: Label {
                                        text: qsTr("Send")
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        color: "#2563EB"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }
                                AbstractButton {
                                    padding: 0
                                    implicitHeight: 36
                                    implicitWidth: 68
                                    onClicked: appController.deleteTemplate(modelData.id)
                                    background: Rectangle {
                                        radius: 8
                                        color: "#F8FAFC"
                                        border.width: 1
                                        border.color: "#E2E8F0"
                                    }
                                    contentItem: Label {
                                        text: qsTr("Remove")
                                        font.pixelSize: 12
                                        font.weight: Font.Medium
                                        color: "#64748B"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }
                            }
                        }
                    }
                }

                Item { Layout.preferredHeight: 24 }
            }
        }

        // TAB 2: Scheduled Alerts
        ScrollView {
            id: schedScroll
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: schedScroll.availableWidth < 540
                       ? schedScroll.availableWidth - 24
                       : Math.min(schedScroll.availableWidth - 48, 860)
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.top: parent.top
                anchors.topMargin: 20
                spacing: 18

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: schedForm.implicitHeight + 36
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: schedForm
                        anchors.fill: parent
                        anchors.margins: 18
                        spacing: 12

                        Label { text: qsTr("Add Scheduled Alert"); font.pixelSize: 16; font.weight: Font.Bold; color: "#0F172A" }

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

                        AbstractButton {
                            id: addSchedBtn
                            padding: 0
                            implicitHeight: 44
                            implicitWidth: Math.max(150, addSchedRow.implicitWidth + 28)
                            onClicked: {
                                appController.addScheduledAlert(1, schedTitle.text, schedBody.text, schedMode.currentText, schedTime.text, schedInterval.value)
                                schedTitle.text = ""
                                schedBody.text = ""
                            }
                            background: Rectangle {
                                radius: 10
                                color: addSchedBtn.pressed ? "#1D4ED8" : "#2563EB"
                            }
                            contentItem: Item {
                                Row {
                                    id: addSchedRow
                                    anchors.centerIn: parent
                                    spacing: 7
                                    FitIcon { anchors.verticalCenter: parent.verticalCenter; name: "calendar"; size: 16; color: "#FFFFFF" }
                                    Label {
                                        anchors.verticalCenter: parent.verticalCenter
                                        text: qsTr("Add Schedule")
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
                    implicitHeight: schedListCol.implicitHeight + 36
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: schedListCol
                        anchors.fill: parent
                        anchors.margins: 18
                        spacing: 10

                        Label { text: qsTr("Active Schedules"); font.pixelSize: 15; font.weight: Font.DemiBold; color: "#0F172A" }

                        Label {
                            visible: appController.scheduledAlerts.length === 0
                            text: qsTr("No scheduled alerts yet. Create a reminder above to push alerts automatically.")
                            font.pixelSize: 13
                            color: "#64748B"
                            wrapMode: Text.WordWrap
                            Layout.fillWidth: true
                        }

                        Repeater {
                            model: appController.scheduledAlerts
                            delegate: RowLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                spacing: 8

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2
                                    Label { text: modelData.title; font.weight: Font.Medium; color: "#0F172A"; elide: Text.ElideRight; Layout.fillWidth: true }
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
                                AbstractButton {
                                    padding: 0
                                    enabled: appController.isConnected
                                    implicitHeight: 36
                                    implicitWidth: 68
                                    onClicked: appController.fireScheduledAlertNow(modelData.id)
                                    background: Rectangle {
                                        radius: 8
                                        color: "#EFF6FF"
                                        opacity: parent.enabled ? 1.0 : 0.45
                                    }
                                    contentItem: Label {
                                        text: qsTr("Send")
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        color: "#2563EB"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }
                                AbstractButton {
                                    padding: 0
                                    implicitHeight: 36
                                    implicitWidth: 64
                                    onClicked: appController.deleteScheduledAlert(modelData.id)
                                    background: Rectangle {
                                        radius: 8
                                        color: "#F8FAFC"
                                        border.width: 1
                                        border.color: "#E2E8F0"
                                    }
                                    contentItem: Label {
                                        text: qsTr("Delete")
                                        font.pixelSize: 12
                                        font.weight: Font.Medium
                                        color: "#64748B"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }
                            }
                        }
                    }
                }

                Item { Layout.preferredHeight: 24 }
            }
        }

        // TAB 3: OS Notification Mirroring (Linux D-Bus / Android NotificationListenerService)
        ScrollView {
            id: mirrorScroll
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: mirrorScroll.availableWidth < 540
                       ? mirrorScroll.availableWidth - 24
                       : Math.min(mirrorScroll.availableWidth - 48, 860)
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.top: parent.top
                anchors.topMargin: 20
                spacing: 18

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: mirrorCard.implicitHeight + 36
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: mirrorCard
                        anchors.fill: parent
                        anchors.margins: 18
                        spacing: 14

                        RowLayout {
                            Layout.fillWidth: true
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2
                                Label { text: qsTr("Mirror System Notifications"); font.pixelSize: 16; font.weight: Font.Bold; color: "#0F172A" }
                                Label { text: appController.osBridgePlatform; font.pixelSize: 12; color: "#64748B" }
                            }
                            Switch {
                                checked: appController.osMirroringEnabled
                                enabled: appController.osBridgeAvailable
                                onToggled: appController.osMirroringEnabled = checked
                            }
                        }

                        ColumnLayout {
                            visible: appController.osBridgeAvailable && !appController.osBridgeHasPermission
                            Layout.fillWidth: true
                            spacing: 10
                            Label {
                                text: qsTr("Notification access permission is required on Android to mirror system alerts.")
                                color: "#D97706"
                                font.pixelSize: 13
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                            }
                            Flow {
                                Layout.fillWidth: true
                                spacing: 10
                                AbstractButton {
                                    padding: 0
                                    implicitHeight: 42
                                    implicitWidth: 148
                                    onClicked: appController.openOsNotificationSettings()
                                    background: Rectangle { radius: 10; color: "#D97706" }
                                    contentItem: Label {
                                        text: qsTr("Open Settings")
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        color: "#FFFFFF"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }
                                AbstractButton {
                                    padding: 0
                                    implicitHeight: 42
                                    implicitWidth: 112
                                    onClicked: appController.refreshOsNotificationPermission()
                                    background: Rectangle { radius: 10; color: "#F8FAFC"; border.width: 1; border.color: "#CBD5E1" }
                                    contentItem: Label {
                                        text: qsTr("Recheck")
                                        font.pixelSize: 13
                                        font.weight: Font.Medium
                                        color: "#0F172A"
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }
                                }
                            }
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: filterCol.implicitHeight + 36
                    radius: 14
                    color: "#FFFFFF"
                    border.color: "#E2E8F0"
                    border.width: 1

                    ColumnLayout {
                        id: filterCol
                        anchors.fill: parent
                        anchors.margins: 18
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
    }
}
