import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

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

        // Device Information (0x180A)
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
                spacing: 12

                Label { text: qsTr("Device Information (GATT 0x180A)"); font.pixelSize: 16; font.weight: Font.DemiBold; color: "#0F172A" }

                GridLayout {
                    Layout.fillWidth: true
                    columns: root.width < 600 ? 1 : 2
                    columnSpacing: 24
                    rowSpacing: 10

                    Label { text: qsTr("Manufacturer: %1").arg(appController.deviceInfo.manufacturer || "-"); color: "#0F172A" }
                    Label { text: qsTr("Model: %1").arg(appController.deviceInfo.model || "-"); color: "#0F172A" }
                    Label { text: qsTr("Firmware: %1").arg(appController.deviceInfo.firmware || "-"); color: "#0F172A" }
                    Label { text: qsTr("Hardware: %1").arg(appController.deviceInfo.hardware || "-"); color: "#0F172A" }
                    Label { text: qsTr("Detected Protocol: %1").arg(appController.detectedProtocolLabel); color: "#475569" }
                    Label { text: qsTr("BLE Address: %1").arg(appController.deviceAddress || "-"); color: "#475569" }
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
                    Label { text: qsTr("BLE Packet Activity Log"); font.pixelSize: 16; font.weight: Font.DemiBold; color: "#0F172A"; Layout.fillWidth: true }
                    Button { text: qsTr("Clear"); flat: true; onClicked: appController.clearPacketLog() }
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
