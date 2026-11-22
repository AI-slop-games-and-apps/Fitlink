import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

ScrollView {
    id: root
    contentWidth: availableWidth
    clip: true

    property date currentNow: new Date()

    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: root.currentNow = new Date()
    }

    ColumnLayout {
        width: Math.min(root.availableWidth - 48, 840)
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: 24
        spacing: 20

        // Host Clock & Instant Sync Card
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: clockCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: clockCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 16

                Label {
                    text: qsTr("System Clock")
                    font.pixelSize: 13
                    color: "#64748B"
                }

                Label {
                    text: Qt.formatTime(root.currentNow, appController.use24Hour ? "HH:mm:ss" : "hh:mm:ss AP")
                    font.pixelSize: 40
                    font.weight: Font.Bold
                    color: "#0F172A"
                }

                Label {
                    text: Qt.formatDate(root.currentNow, "dddd, MMMM d, yyyy") + " · " + qsTr("Last synced: %1").arg(appController.lastSyncedTime)
                    font.pixelSize: 13
                    color: "#475569"
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }

                RowLayout {
                    spacing: 12
                    Button {
                        text: qsTr("Sync Time Now")
                        highlighted: true
                        enabled: appController.isConnected
                        onClicked: appController.syncTimeNow()
                    }
                }
            }
        }

        // Clock Preferences Card
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: prefCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: prefCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 14

                Label {
                    text: qsTr("Clock Preferences")
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                    color: "#0F172A"
                }

                RowLayout {
                    Layout.fillWidth: true
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("24-Hour Time Format"); font.weight: Font.Medium; color: "#0F172A" }
                        Label { text: qsTr("Sends FEEA command 0x27 immediately when connected"); font.pixelSize: 12; color: "#64748B" }
                    }
                    Switch {
                        checked: appController.use24Hour
                        onToggled: appController.use24Hour = checked
                    }
                }

                Rectangle { Layout.fillWidth: true; height: 1; color: "#E2E8F0" }

                RowLayout {
                    Layout.fillWidth: true
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Auto-Sync on Connect"); font.weight: Font.Medium; color: "#0F172A" }
                        Label { text: qsTr("Automatically pushes local time whenever the watch reconnects"); font.pixelSize: 12; color: "#64748B" }
                    }
                    Switch {
                        checked: appController.autoSyncOnConnect
                        onToggled: appController.autoSyncOnConnect = checked
                    }
                }
            }
        }

        // Custom Time & Timezone Override Card
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: customCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: customCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 14

                Label {
                    text: qsTr("Custom Time & Timezone Override")
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                    color: "#0F172A"
                }

                GridLayout {
                    Layout.fillWidth: true
                    columns: root.width < 600 ? 1 : 2
                    columnSpacing: 16
                    rowSpacing: 12

                    TextField {
                        id: customIsoField
                        Layout.fillWidth: true
                        placeholderText: qsTr("YYYY-MM-DDTHH:MM:SS")
                        text: Qt.formatDateTime(new Date(), "yyyy-MM-ddTHH:mm:ss")
                    }

                    SpinBox {
                        id: utcOffsetHours
                        Layout.fillWidth: true
                        from: -12
                        to: 14
                        value: Math.round(-new Date().getTimezoneOffset() / 60)
                        textFromValue: function(value) {
                            return "UTC" + (value >= 0 ? "+" : "") + value
                        }
                    }
                }

                Button {
                    text: qsTr("Push Custom Time")
                    enabled: appController.isConnected
                    onClicked: appController.syncCustomTime(customIsoField.text, utcOffsetHours.value * 60)
                }
            }
        }

        Item { Layout.preferredHeight: 24 }
    }
}
