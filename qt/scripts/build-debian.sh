#!/usr/bin/env bash
set -euo pipefail

# Build FitLink on Debian for amd64 (native) or arm64 (native or cross-compiled from amd64).
# Usage:
#   ./scripts/build-debian.sh amd64
#   ./scripts/build-debian.sh arm64

ARCH="${1:-$(dpkg --print-architecture)}"
HOST_ARCH="$(dpkg --print-architecture)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build-debian-${ARCH}"

echo "==> Building FitLink for Debian (${ARCH}) on host (${HOST_ARCH})"

CMAKE_ARGS=(
  -S "${ROOT_DIR}"
  -B "${BUILD_DIR}"
  -G Ninja
  -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_INSTALL_PREFIX=/usr
)

if [[ "${ARCH}" == "arm64" && "${HOST_ARCH}" == "amd64" ]]; then
  echo "==> Using Debian arm64 cross-compilation toolchain"
  CMAKE_ARGS+=(-DCMAKE_TOOLCHAIN_FILE="${ROOT_DIR}/cmake/toolchains/debian-arm64.cmake")
fi

cmake "${CMAKE_ARGS[@]}"
cmake --build "${BUILD_DIR}" --parallel
cpack --config "${BUILD_DIR}/CPackConfig.cmake" -B "${BUILD_DIR}"

echo "==> Build complete. Generated .deb package(s):"
ls -lh "${BUILD_DIR}"/*.deb
