#!/usr/bin/env bash
set -euo pipefail

# Build FitLink Android APK using Qt 6 for Android on Debian.
# Prerequisites:
#   - Qt 6 Android SDK installed (e.g. ~/Qt/6.7.2/android_arm64_v8a)
#   - Android SDK + NDK installed (ANDROID_SDK_ROOT and ANDROID_NDK_ROOT exported)
# Usage:
#   QT_ANDROID_DIR=~/Qt/6.7.2/android_arm64_v8a ./scripts/build-android.sh

QT_ANDROID_DIR="${QT_ANDROID_DIR:?Set QT_ANDROID_DIR (e.g. ~/Qt/6.7.2/android_arm64_v8a)}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT}"
ANDROID_NDK_ROOT="${ANDROID_NDK_ROOT:?Set ANDROID_NDK_ROOT}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build-android-arm64-v8a"

echo "==> Configuring FitLink for Android (arm64-v8a)"

"${QT_ANDROID_DIR}/bin/qt-cmake" \
  -S "${ROOT_DIR}" \
  -B "${BUILD_DIR}" \
  -G Ninja \
  -DCMAKE_MAKE_PROGRAM="$(command -v ninja)" \
  -DCMAKE_BUILD_TYPE=Release \
  -DANDROID_SDK_ROOT="${ANDROID_SDK_ROOT}" \
  -DANDROID_NDK_ROOT="${ANDROID_NDK_ROOT}" \
  -DQT_ANDROID_BUILD_ALL_ABIS=OFF

cmake --build "${BUILD_DIR}" --target apk --parallel

echo "==> Android APK generated:"
find "${BUILD_DIR}" -name "*.apk" -print
