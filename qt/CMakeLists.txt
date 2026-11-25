cmake_minimum_required(VERSION 3.21)

project(FitLink
    VERSION 1.0.0
    DESCRIPTION "Cross-platform Qt 6 companion app for 0xFEEA BLE smartwatches"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Find Qt 6 modules shared across Linux (amd64/arm64), Android, and future Windows
set(FITLINK_QT_COMPONENTS Core Gui Quick QuickControls2 Bluetooth)
if(UNIX AND NOT ANDROID AND NOT APPLE)
    list(APPEND FITLINK_QT_COMPONENTS DBus)
endif()

find_package(Qt6 6.5 REQUIRED COMPONENTS ${FITLINK_QT_COMPONENTS})

qt_standard_project_setup(REQUIRES 6.5)

set(FITLINK_SOURCES
    src/main.cpp
    src/protocol/FeeaCodec.h
    src/protocol/FeeaCodec.cpp
    src/ble/BleWatchManager.h
    src/ble/BleWatchManager.cpp
    src/notifications/PlatformNotificationBridge.h
    src/core/AppController.h
    src/core/AppController.cpp
)

# Platform-specific OS notification mirroring backends
if(ANDROID)
    list(APPEND FITLINK_SOURCES
        src/notifications/AndroidNotificationBridge.h
        src/notifications/AndroidNotificationBridge.cpp
    )
elseif(UNIX AND NOT APPLE)
    list(APPEND FITLINK_SOURCES
        src/notifications/LinuxDbusNotificationBridge.h
        src/notifications/LinuxDbusNotificationBridge.cpp
    )
else()
    # Clean stub for future Windows (WinRT UserNotificationListener) or macOS builds
    list(APPEND FITLINK_SOURCES
        src/notifications/StubNotificationBridge.h
    )
endif()

qt_add_executable(fitlink
    ${FITLINK_SOURCES}
)

qt_add_qml_module(fitlink
    URI FitLink
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/components/DeviceScanDialog.qml
        qml/views/OverviewView.qml
        qml/views/ActivityView.qml
        qml/views/TimeSyncView.qml
        qml/views/NotificationsView.qml
        qml/views/DeviceProtocolView.qml
)

target_include_directories(fitlink PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(fitlink PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::Bluetooth
)

if(UNIX AND NOT ANDROID AND NOT APPLE)
    target_link_libraries(fitlink PRIVATE Qt6::DBus)
    target_compile_definitions(fitlink PRIVATE FITLINK_PLATFORM_LINUX_DBUS=1)
elseif(ANDROID)
    target_compile_definitions(fitlink PRIVATE FITLINK_PLATFORM_ANDROID=1)
    set_target_properties(fitlink PROPERTIES
        QT_ANDROID_PACKAGE_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/android"
        QT_ANDROID_PACKAGE_NAME "org.fitlink.watch"
        QT_ANDROID_MIN_SDK_VERSION 28
        QT_ANDROID_TARGET_SDK_VERSION 34
        QT_ANDROID_VERSION_CODE 1
        QT_ANDROID_VERSION_NAME "${PROJECT_VERSION}"
    )
elseif(WIN32)
    target_compile_definitions(fitlink PRIVATE FITLINK_PLATFORM_WINDOWS=1)
    set_target_properties(fitlink PROPERTIES WIN32_EXECUTABLE TRUE)
endif()

# Linux desktop install & CPack .deb rules (supports both amd64 and arm64)
if(UNIX AND NOT ANDROID AND NOT APPLE)
    include(GNUInstallDirs)
    install(TARGETS fitlink
        RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    )
    install(FILES packaging/fitlink.desktop
        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/applications
    )
    install(FILES packaging/fitlink.svg
        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/icons/hicolor/scalable/apps
    )

    set(CPACK_GENERATOR "DEB")
    set(CPACK_PACKAGE_NAME "fitlink")
    set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
    set(CPACK_PACKAGE_CONTACT "FitLink Maintainers <maintainers@fitlink.local>")
    set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Qt 6 BLE Smartwatch Companion (0xFEEA Protocol)")
    set(CPACK_DEBIAN_PACKAGE_SHLIBDEPS ON)
    set(CPACK_DEBIAN_PACKAGE_SECTION "utils")
    set(CPACK_DEBIAN_PACKAGE_DEPENDS "qml6-module-qtquick-controls, qml6-module-qtquick-layouts, qml6-module-qtquick-templates, qml6-module-qtquick-window")
    set(CPACK_DEBIAN_PACKAGE_SUGGESTS "bluez")
    set(CPACK_DEBIAN_FILE_NAME DEB-DEFAULT)
    include(CPack)
endif()
