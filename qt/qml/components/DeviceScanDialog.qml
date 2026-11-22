import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

Dialog {
    id: root
    title: qsTr("Connect BLE Watch")
    modal: true
    anchors.centerIn: parent
    width: Math.min(parent.width - 32, 460)
    height: Math.min(parent.height - 64, 520)
    standardButtons: Dialog.Close

    onClosed: appController.stopScan()

    ColumnLayout {
        anchors.fill: parent
        spacing: 12

        RowLayout {
            Layout.fillWidth: true
            Switch {
                text: qsTr("Show all BLE devices")
                checked: appController.showAllBleDevices
                onToggled: {
                    appController.showAllBleDevices = checked
                    appController.startScan()
                }
            }
            Item { Layout.fillWidth: true }
            Button {
                text: appController.isScanning ? qsTr("Stop Scan") : qsTr("Rescan")
                flat: true
                onClicked: appController.isScanning ? appController.stopScan() : appController.startScan()
            }
        }

        BusyIndicator {
            Layout.alignment: Qt.AlignHCenter
            running: appController.isScanning
            visible: appController.isScanning
        }

        ListView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            spacing: 8
            model: appController.discoveredDevices

            delegate: Rectangle {
                required property var modelData
                width: ListView.view.width
                height: 64
                radius: 10
                color: "#FFFFFF"
                border.color: "#E2E8F0"
                border.width: 1

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 12

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label {
                            text: modelData.name
                            font.weight: Font.DemiBold
                            color: "#0F172A"
                            elide: Text.ElideRight
                            Layout.fillWidth: true
                        }
                        Label {
                            text: qsTr("%1 · %2 dBm").arg(modelData.id).arg(modelData.rssi)
                            font.pixelSize: 12
                            color: "#64748B"
                        }
                    }

                    Button {
                        text: qsTr("Pair")
                        highlighted: true
                        onClicked: {
                            appController.connectToDevice(modelData.id)
                            root.close()
                        }
                    }
                }
            }

            Label {
                anchors.centerIn: parent
                visible: appController.discoveredDevices.length === 0 && !appController.isScanning
                text: qsTr("No compatible watches found yet.\nWake your watch screen and tap Rescan.")
                horizontalAlignment: Text.AlignHCenter
                color: "#64748B"
            }
        }
    }
}
