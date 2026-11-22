# FitLink — Cross-Platform Qt 6 BLE Watch Companion

**FitLink** is an independent, open-source **Qt 6 (C++17 + QML Material 3 + CMake)** companion application for `0xFEEA` BLE protocol smartwatches (V1 & V2 framing) built from a single codebase for **Debian Linux (`amd64` and `arm64`)** and **Android (API 28+)**, with a clean platform abstraction ready for future Windows support.

## Core Capabilities

- **FEEA V1 & V2 BLE Engine (`Qt6::Bluetooth`):** Connects to GATT service `0xFEEA` (`0xFEE2` write / `0xFEE3` notify), auto-detects V2 vs. V1 protocol framing from Device Information (`0x180A / 0x2A29`) with manual override, configurable MTU chunking (`20–244 B`), and paced write queueing.
- **Time Synchronization (`0x31`):** One-click host clock sync, automatic sync on connect, 12h/24h watch display toggle (`0x27`), and custom date/time + UTC offset override.
- **OS Notification Mirroring:**
  - **Linux (`amd64` & `arm64`):** Dedicated `Qt6::DBus` session monitor using `org.freedesktop.DBus.Monitoring.BecomeMonitor` capturing `org.freedesktop.Notifications.Notify` with per-app filtering and icon mapping.
  - **Android:** `FitLinkNotificationService` (`NotificationListenerService`) forwarding system alerts to C++ via thread-safe JNI callbacks, plus a one-tap Android Notification Access settings launcher.
- **Manual Composer, Templates & Scheduled Alerts:** App icon presets (Call, SMS, WhatsApp, Telegram, Gmail, Calendar, Slack, Instagram, Generic), live UTF-8 byte & chunk counters, saved templates, and a 1-second timer scheduler for one-time or recurring interval reminders.
- **Battery, Device Info & Find Watch (`0x61`):** Live Battery Service (`0x180F / 0x2A19`) read + notify, firmware/model/hardware info (`0x180A`), and one-tap Find Watch vibration trigger.

---

## Building on Debian (`amd64` & `arm64`)

### 1. Install Debian Build Dependencies (Native `amd64` or Native `arm64`)

```bash
sudo apt update
sudo apt install -y \
  build-essential cmake ninja-build pkgconf file fakeroot debhelper \
  qt6-base-dev qt6-declarative-dev qt6-connectivity-dev \
  qml6-module-qtquick qml6-module-qtquick-controls \
  qml6-module-qtquick-layouts qml6-module-qtquick-templates \
  qml6-module-qtquick-window bluez
```

### 2. Build Native `.deb` Package

```bash
cd qt
./scripts/build-debian.sh
# Or using standard Debian packaging tools:
dpkg-buildpackage -b -us -uc
```

### 3. Cross-Compile Debian `arm64` on a Debian `amd64` Host

```bash
sudo dpkg --add-architecture arm64
sudo apt update
sudo apt install -y \
  crossbuild-essential-arm64 pkgconf dpkg-dev file fakeroot binutils-multiarch libgl-dev:arm64 \
  qt6-base-dev:arm64 qt6-declarative-dev:arm64 qt6-connectivity-dev:arm64 \
  qt6-base-dev-tools qt6-declarative-dev-tools

cd qt
./scripts/build-debian.sh arm64
```

---

## Building for Android (from Debian)

1. Install **Qt 6 for Android** (`android_arm64_v8a` / `android_armv7`) via the Qt Online Installer and configure **Android SDK** (`API 34`) and **Android NDK** (`r26+`).
2. Run the Android APK build script:

```bash
cd qt
export ANDROID_SDK_ROOT=~/Android/Sdk
export ANDROID_NDK_ROOT=~/Android/Sdk/ndk/26.1.10909125
export QT_ANDROID_DIR=~/Qt/6.8.2/android_arm64_v8a

./scripts/build-android.sh
```

The APK will be written under `qt/build-android-arm64-v8a/android-build/build/outputs/apk/`.

---

## GitHub Actions CI / Releases

The included GitHub Actions workflow builds and uploads artifacts automatically on every push, pull request, and manual dispatch:

- **Debian `amd64`** (`.deb` built natively on `ubuntu-latest` inside `debian:trixie`)
- **Debian `arm64`** (`.deb` built natively on `ubuntu-24.04-arm` inside `debian:trixie`)
- **Android** (`arm64-v8a` and `armeabi-v7a` `.apk` packages built with Qt 6.8.2 + `qtconnectivity`)

Pushing a version tag (e.g. `git tag v1.0.0 && git push origin v1.0.0`) automatically publishes a GitHub Release with all `.deb` and `.apk` files attached.

