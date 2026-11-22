# Cross-compilation toolchain for Debian arm64 (aarch64-linux-gnu) from a Debian amd64 host.
# Prerequisite on Debian Trixie (13) amd64 host:
#   sudo dpkg --add-architecture arm64
#   sudo apt update
#   sudo apt install crossbuild-essential-arm64 pkgconf dpkg-dev \
#     libgl-dev:arm64 qt6-base-dev:arm64 qt6-declarative-dev:arm64 \
#     qt6-connectivity-dev:arm64 qt6-base-dev-tools qt6-declarative-dev-tools

set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_LIBRARY_ARCHITECTURE aarch64-linux-gnu)

set(CMAKE_C_COMPILER aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_AR aarch64-linux-gnu-ar)
set(CMAKE_STRIP aarch64-linux-gnu-strip)

set(CMAKE_PREFIX_PATH "/usr/lib/aarch64-linux-gnu/cmake")
set(CMAKE_IGNORE_PATH "/usr/lib/x86_64-linux-gnu" "/lib/x86_64-linux-gnu")

# Point Qt 6 host code-gen tools (moc, rcc, qmlcachegen) to native amd64 host binaries
set(QT_HOST_PATH "/usr" CACHE PATH "Host Qt 6 installation prefix")
set(QT_HOST_PATH_CMAKE_DIR "/usr/lib/x86_64-linux-gnu/cmake" CACHE PATH "Host Qt 6 CMake dir")

# Configure pkgconf to search arm64 multiarch .pc files
set(PKG_CONFIG_EXECUTABLE "/usr/bin/pkg-config" CACHE FILEPATH "pkgconf binary")
set(ENV{PKG_CONFIG_PATH} "")
set(ENV{PKG_CONFIG_LIBDIR} "/usr/lib/aarch64-linux-gnu/pkgconfig:/usr/share/pkgconfig")

set(CPACK_DEBIAN_PACKAGE_ARCHITECTURE "arm64")
