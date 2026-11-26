import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts
import FitLink

ApplicationWindow {
    id: window
    width: 1120
    height: 740
    minimumWidth: 360
    minimumHeight: 600
    visible: true
    title: qsTr("FitLink")

    Material.theme: Material.Light
    Material.primary: "#2563EB"
    Material.accent: "#2563EB"
    Material.background: "#F5F7FA"

    property int currentTab: 0
    readonly property bool isCompact: width < 768
    readonly property var navItems: [
        { label: qsTr("Overview"), shortLabel: qsTr("Overview"), icon: "overview" },
        { label: qsTr("Activity"), shortLabel: qsTr("Activity"), icon: "activity" },
        { label: qsTr("Time Sync"), shortLabel: qsTr("Time"), icon: "time" },
        { label: qsTr("Notifications"), shortLabel: qsTr("Alerts"), icon: "alerts" },
        { label: qsTr("Device & Protocol"), shortLabel: qsTr("Device"), icon: "device" }
    ]

    DeviceScanDialog {
        id: scanDialog
    }

    Connections {
        target: appController
        function onToastMessage(message, isError) {
            toastBanner.text = message
            toastBanner.isError = isError
            toastBanner.visible = true
            toastHideTimer.restart()
        }
    }

    Timer {
        id: toastHideTimer
        interval: 3200
        onTriggered: toastBanner.visible = false
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // Desktop / Tablet Left Navigation Rail (Debian amd64 / arm64)
        Rectangle {
            visible: !window.isCompact
            Layout.fillHeight: true
            Layout.preferredWidth: 240
            color: "#FFFFFF"

            Rectangle {
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 1
                color: "#E2E8F0"
            }

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 8

                Label {
                    text: "FitLink"
                    font.pixelSize: 20
                    font.weight: Font.Bold
                    color: "#0F172A"
                    Layout.bottomMargin: 12
                    Layout.leftMargin: 8
                }

                Repeater {
                    model: window.navItems
                    delegate: ItemDelegate {
                        required property int index
                        required property var modelData
                        Layout.fillWidth: true
                        height: 44
                        text: modelData.label
                        font.weight: window.currentTab === index ? Font.DemiBold : Font.Medium
                        onClicked: window.currentTab = index
                        background: Rectangle {
                            radius: 10
                            color: window.currentTab === index ? "#EFF6FF" : (parent.hovered ? "#F8FAFC" : "transparent")
                        }
                        contentItem: RowLayout {
                            spacing: 12
                            Item { Layout.preferredWidth: 4 }
                            FitIcon {
                                name: modelData.icon
                                size: 19
                                color: window.currentTab === index ? "#2563EB" : "#64748B"
                            }
                            Label {
                                text: modelData.label
                                color: window.currentTab === index ? "#2563EB" : "#475569"
                                font.pixelSize: 14
                                font.weight: window.currentTab === index ? Font.DemiBold : Font.Medium
                                verticalAlignment: Text.AlignVCenter
                                Layout.fillWidth: true
                            }
                        }
                    }
                }

                Item { Layout.fillHeight: true }

                Rectangle {
                    Layout.fillWidth: true
                    height: 1
                    color: "#E2E8F0"
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.topMargin: 8
                    Layout.leftMargin: 8
                    spacing: 4

                    Label {
                        text: appController.isConnected ? appController.deviceName : qsTr("No watch paired")
                        font.weight: Font.DemiBold
                        font.pixelSize: 13
                        color: "#0F172A"
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                    Label {
                        text: appController.isConnected
                              ? (appController.batteryLevel >= 0
                                 ? qsTr("Connected · %1% · %2").arg(appController.batteryLevel).arg(appController.activeProtocolLabel)
                                 : qsTr("Connected · %1").arg(appController.activeProtocolLabel))
                              : (appController.bluetoothAvailable
                                 ? qsTr("Disconnected · BLE Ready")
                                 : qsTr("Bluetooth Unavailable"))
                        font.pixelSize: 12
                        color: appController.isConnected
                               ? "#16A34A"
                               : (appController.bluetoothAvailable ? "#64748B" : "#D97706")
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }
            }
        }

        // Main Workspace Column
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            // Single-row Top App Bar
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 60
                color: "#FFFFFF"

                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    height: 1
                    color: "#E2E8F0"
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 24
                    anchors.rightMargin: 24
                    spacing: 16

                    Label {
                        text: window.navItems[window.currentTab].label
                        font.pixelSize: 18
                        font.weight: Font.DemiBold
                        color: "#0F172A"
                        Layout.fillWidth: true
                        elide: Text.ElideRight
                    }

                    AbstractButton {
                        id: connectActionBtn
                        padding: 0
                        implicitHeight: 40
                        implicitWidth: connectBtnRow.implicitWidth + 28
                        onClicked: {
                            if (appController.isConnected) {
                                appController.disconnectDevice()
                            } else {
                                scanDialog.open()
                                if (appController.bluetoothAvailable) {
                                    appController.startScan()
                                }
                            }
                        }
                        background: Rectangle {
                            radius: 10
                            color: appController.isConnected
                                   ? (connectActionBtn.pressed ? "#F1F5F9" : "#FFFFFF")
                                   : (connectActionBtn.pressed ? "#1D4ED8" : "#2563EB")
                            border.width: appController.isConnected ? 1 : 0
                            border.color: "#CBD5E1"
                        }
                        contentItem: Item {
                            Row {
                                id: connectBtnRow
                                anchors.centerIn: parent
                                spacing: 7
                                FitIcon {
                                    anchors.verticalCenter: parent.verticalCenter
                                    name: "bluetooth"
                                    size: 16
                                    color: appController.isConnected ? "#475569" : "#FFFFFF"
                                }
                                Label {
                                    anchors.verticalCenter: parent.verticalCenter
                                    text: appController.isConnected ? qsTr("Disconnect") : qsTr("Connect Watch")
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                    color: appController.isConnected ? "#0F172A" : "#FFFFFF"
                                }
                            }
                        }
                    }
                }
            }

            // Non-blocking Bluetooth / BlueZ availability notice on launch
            Rectangle {
                visible: !appController.bluetoothAvailable
                Layout.fillWidth: true
                Layout.preferredHeight: btBannerRow.implicitHeight + 16
                color: "#FFFBEB"

                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    height: 1
                    color: "#FDE68A"
                }

                RowLayout {
                    id: btBannerRow
                    anchors.fill: parent
                    anchors.leftMargin: 24
                    anchors.rightMargin: 24
                    anchors.topMargin: 8
                    anchors.bottomMargin: 8
                    spacing: 12

                    Label {
                        text: appController.bluetoothStatusMessage
                        font.pixelSize: 13
                        color: "#92400E"
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }

                    Button {
                        text: qsTr("Recheck")
                        flat: true
                        onClicked: appController.recheckBluetoothAvailability()
                    }
                }
            }

            // Active View Stack
            StackLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                currentIndex: window.currentTab

                OverviewView {}
                ActivityView {}
                TimeSyncView {}
                NotificationsView {}
                DeviceProtocolView {}
            }

            // Compact Bottom Navigation Bar with icons + labels (Android mobile screens)
            Rectangle {
                visible: window.isCompact
                Layout.fillWidth: true
                Layout.preferredHeight: 68
                color: "#FFFFFF"

                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.top: parent.top
                    height: 1
                    color: "#E2E8F0"
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 4
                    anchors.rightMargin: 4
                    spacing: 0

                    Repeater {
                        model: window.navItems
                        delegate: AbstractButton {
                            id: bottomTabBtn
                            required property int index
                            required property var modelData
                            readonly property bool isActive: window.currentTab === index

                            padding: 0
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            onClicked: window.currentTab = index

                            background: Item {}

                            contentItem: Item {
                                Column {
                                    anchors.centerIn: parent
                                    spacing: 4

                                    Rectangle {
                                        anchors.horizontalCenter: parent.horizontalCenter
                                        width: 52
                                        height: 30
                                        radius: 15
                                        color: bottomTabBtn.isActive
                                               ? "#EFF6FF"
                                               : (bottomTabBtn.pressed ? "#F1F5F9" : "transparent")

                                        FitIcon {
                                            anchors.centerIn: parent
                                            name: modelData.icon
                                            size: 20
                                            color: bottomTabBtn.isActive ? "#2563EB" : "#64748B"
                                        }
                                    }

                                    Label {
                                        anchors.horizontalCenter: parent.horizontalCenter
                                        text: modelData.shortLabel
                                        font.pixelSize: 11
                                        font.weight: bottomTabBtn.isActive ? Font.DemiBold : Font.Medium
                                        color: bottomTabBtn.isActive ? "#2563EB" : "#64748B"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Floating Material Toast Feedback
    Rectangle {
        id: toastBanner
        property string text: ""
        property bool isError: false
        visible: false
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: window.isCompact ? 80 : 24
        height: 44
        width: Math.min(parent.width - 32, toastLabel.implicitWidth + 36)
        radius: 10
        color: isError ? "#DC2626" : "#0F172A"

        Label {
            id: toastLabel
            anchors.centerIn: parent
            text: toastBanner.text
            color: "#FFFFFF"
            font.pixelSize: 13
            font.weight: Font.Medium
        }
    }
}
