#!/usr/bin/env bash
set -euo pipefail

APP_NAME="floatingTODO"
APP_BUNDLE="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
INSTALL_DIR="/Applications"

cd "$(dirname "$0")"

echo "Building ${APP_NAME}..."
npm run tauri build

if [ ! -d "$APP_BUNDLE" ]; then
  echo "Error: build succeeded but ${APP_BUNDLE} not found" >&2
  exit 1
fi

echo "Installing to ${INSTALL_DIR}/${APP_NAME}.app..."
rm -rf "${INSTALL_DIR}/${APP_NAME}.app"
cp -r "$APP_BUNDLE" "${INSTALL_DIR}/"

# Strip Gatekeeper quarantine — required for unsigned apps built locally
xattr -dr com.apple.quarantine "${INSTALL_DIR}/${APP_NAME}.app" 2>/dev/null || true

echo "Done. Launch from /Applications or Spotlight."
