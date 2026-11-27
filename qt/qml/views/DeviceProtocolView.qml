import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import FitLink

ScrollView {
    id: root
    contentWidth: availableWidth
    clip: true

    ColumnLayout {
        width: Math.min(root.availableWidth - 48, 900)
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: 24
        spacing: 20

        // Device Information (GATT 0x180A + 0x180F + 0xFEEA 0x5A)
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: infoCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: infoCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 14

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 12

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label {
                            text: qsTr("Device Information")
                            font.pixelSize: 16
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                        }
                        Label {
                            text: qsTr("Live values reported by watch via GATT 0x180A, 0x180F, and 0xFEEA 0x5A")
                            font.pixelSize: 12
                            color: "#64748B"
                            wrapMode: Text.WordWrap
                            Layout.fillWidth: true
                        }
                    }

                    Button {
                        text: qsTr("Refresh Info")
                        enabled: appController.isConnected
                        flat: false
                        onClicked: appController.refreshDeviceInfo()
                    }
                }

                GridLayout {
                    Layout.fillWidth: true
                    columns: root.width < 600 ? 1 : 2
                    columnSpacing: 24
                    rowSpacing: 12

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Device Name (BLE GAP)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.isConnected && appController.deviceName ? appController.deviceName : "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                            elide: Text.ElideRight
                            Layout.fillWidth: true
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Manufacturer / Protocol (0x2A29 · 0x5A 00)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.deviceInfo.manufacturer || "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                            elide: Text.ElideRight
                            Layout.fillWidth: true
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Firmware Version (0x2A26 · 0x5A 01)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.deviceInfo.firmware || "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                            elide: Text.ElideRight
                            Layout.fillWidth: true
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Detected / Active Protocol"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: qsTr("%1 · %2").arg(appController.detectedProtocolLabel).arg(appController.activeProtocolLabel)
                            font.pixelSize: 14
                            font.weight: Font.Medium
                            color: "#0F172A"
                            elide: Text.ElideRight
                            Layout.fillWidth: true
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Battery Level (0x2A19)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.batteryLevel >= 0 ? appController.batteryLevel + "%" : "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("BLE Address / Device ID"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.deviceAddress || "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            color: "#475569"
                            elide: Text.ElideRight
                            Layout.fillWidth: true
                        }
                    }

                    ColumnLayout {
                        visible: Boolean(appController.deviceInfo.software) && appController.deviceInfo.software !== appController.deviceInfo.firmware
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Software Revision (0x2A28)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.deviceInfo.software || "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                        }
                    }

                    ColumnLayout {
                        visible: Boolean(appController.deviceInfo.model)
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Model Number (0x2A24)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.deviceInfo.model || "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                        }
                    }

                    ColumnLayout {
                        visible: Boolean(appController.deviceInfo.hardware)
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Hardware Revision (0x2A27)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.deviceInfo.hardware || "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                        }
                    }

                    ColumnLayout {
                        visible: Boolean(appController.deviceInfo.serial)
                        Layout.fillWidth: true
                        spacing: 2
                        Label { text: qsTr("Serial Number (0x2A25)"); font.pixelSize: 12; color: "#64748B" }
                        Label {
                            text: appController.deviceInfo.serial || "-"
                            font.pixelSize: 14
                            font.family: "monospace"
                            font.weight: Font.Medium
                            color: "#0F172A"
                        }
                    }
                }
            }
        }

        // FEEA Protocol Settings
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: protoCol.implicitHeight + 40
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: protoCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 14

                Label { text: qsTr("FEEA Protocol & BLE Framing"); font.pixelSize: 16; font.weight: Font.DemiBold; color: "#0F172A" }

                RowLayout {
                    Layout.fillWidth: true
                    Label { text: qsTr("Protocol Mode"); Layout.fillWidth: true; color: "#0F172A" }
                    ComboBox {
                        model: [qsTr("Auto-detect (Recommended)"), qsTr("FEEA V2 (0xFEEA)"), qsTr("FEEA V1 (0xFEEA 0x10)")]
                        currentIndex: appController.protocolPreference
                        onActivated: appController.protocolPreference = currentIndex
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    height: 1
                    color: "#E2E8F0"
                }

                // Collapsed Advanced BLE Settings toggle row
                RowLayout {
                    id: advancedHeader
                    property bool expanded: false
                    Layout.fillWidth: true
                    spacing: 12

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label {
                            text: qsTr("Advanced BLE Settings")
                            font.weight: Font.Medium
                            color: "#0F172A"
                        }
                        Label {
                            text: qsTr("MTU %1 B · Write delay %2 ms").arg(appController.mtuSize).arg(appController.writeDelayMs)
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                    }

                    Button {
                        text: advancedHeader.expanded ? qsTr("Hide") : qsTr("Configure")
                        flat: true
                        onClicked: advancedHeader.expanded = !advancedHeader.expanded
                    }
                }

                ColumnLayout {
                    visible: advancedHeader.expanded
                    Layout.fillWidth: true
                    spacing: 14

                    Label {
                        text: qsTr("Safe defaults (20 B, 50 ms) work on all 0xFEEA watches. Increase delay if long notifications drop.")
                        font.pixelSize: 12
                        color: "#64748B"
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        Label { text: qsTr("MTU Chunk Size: %1 bytes").arg(appController.mtuSize); font.pixelSize: 13; color: "#475569" }
                        Slider {
                            Layout.fillWidth: true
                            from: 20
                            to: 244
                            stepSize: 4
                            value: appController.mtuSize
                            onMoved: appController.mtuSize = Math.round(value)
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        Label { text: qsTr("Inter-Chunk Write Delay: %1 ms").arg(appController.writeDelayMs); font.pixelSize: 13; color: "#475569" }
                        Slider {
                            Layout.fillWidth: true
                            from: 20
                            to: 150
                            stepSize: 10
                            value: appController.writeDelayMs
                            onMoved: appController.writeDelayMs = Math.round(value)
                        }
                    }

                    Button {
                        text: qsTr("Reset to Defaults")
                        flat: true
                        enabled: appController.mtuSize !== 20 || appController.writeDelayMs !== 50
                        onClicked: {
                            appController.mtuSize = 20
                            appController.writeDelayMs = 50
                        }
                    }
                }
            }
        }

        // BLE Command Log
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: Math.max(180, logCol.implicitHeight + 40)
            radius: 14
            color: "#FFFFFF"
            border.color: "#E2E8F0"
            border.width: 1

            ColumnLayout {
                id: logCol
                anchors.fill: parent
                anchors.margins: 20
                spacing: 10

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 6
                    Label {
                        text: qsTr("BLE Packet Activity Log")
                        font.pixelSize: 16
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }

                    TextEdit {
                        id: clipboardHelper
                        visible: false
                    }

                    Timer {
                        id: copiedResetTimer
                        interval: 1800
                        onTriggered: copyLogBtn.copied = false
                    }

                    AbstractButton {
                        id: copyLogBtn
                        property bool copied: false
                        padding: 0
                        enabled: appController.packetLog.length > 0
                        implicitWidth: 32
                        implicitHeight: 32
                        ToolTip.visible: hovered
                        ToolTip.text: copied ? qsTr("Copied") : qsTr("Copy packet log")
                        onClicked: {
                            var lines = []
                            for (var i = 0; i < appController.packetLog.length; ++i) {
                                var e = appController.packetLog[i]
                                lines.push(e.timestamp + "\t" + e.direction + "\t" + e.actionLabel + "\t" + e.hexPreview + "\t" + e.chunkCount)
                            }
                            clipboardHelper.text = lines.join("\n")
                            clipboardHelper.selectAll()
                            clipboardHelper.copy()
                            copied = true
                            copiedResetTimer.restart()
                        }
                        background: Rectangle {
                            radius: 8
                            color: copyLogBtn.pressed ? "#E2E8F0" : (copyLogBtn.hovered ? "#F1F5F9" : "transparent")
                            opacity: copyLogBtn.enabled ? 1.0 : 0.4
                        }
                        contentItem: Item {
                            FitIcon {
                                anchors.centerIn: parent
                                name: copyLogBtn.copied ? "check" : "copy"
                                size: 16
                                color: copyLogBtn.copied ? "#16A34A" : "#64748B"
                            }
                        }
                    }

                    AbstractButton {
                        id: clearLogBtn
                        padding: 0
                        enabled: appController.packetLog.length > 0
                        implicitWidth: 32
                        implicitHeight: 32
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Clear packet log")
                        onClicked: appController.clearPacketLog()
                        background: Rectangle {
                            radius: 8
                            color: clearLogBtn.pressed ? "#FEE2E2" : (clearLogBtn.hovered ? "#F1F5F9" : "transparent")
                            opacity: clearLogBtn.enabled ? 1.0 : 0.4
                        }
                        contentItem: Item {
                            FitIcon {
                                anchors.centerIn: parent
                                name: "trash"
                                size: 16
                                color: clearLogBtn.hovered ? "#DC2626" : "#64748B"
                            }
                        }
                    }
                }

                Repeater {
                    model: appController.packetLog
                    delegate: ColumnLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 2
                        RowLayout {
                            Layout.fillWidth: true
                            Label { text: modelData.timestamp + " · " + modelData.direction.toUpperCase(); font.pixelSize: 12; color: "#2563EB" }
                            Label { text: modelData.actionLabel; font.pixelSize: 13; font.weight: Font.Medium; color: "#0F172A"; Layout.fillWidth: true }
                            Label { text: qsTr("%1 chunk(s)").arg(modelData.chunkCount); font.pixelSize: 12; color: "#64748B" }
                        }
                        Label {
                            text: modelData.hexPreview
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

        Item { Layout.preferredHeight: 24 }
    }
}
