#!/bin/bash
# Regenerate every shipped icon from resources/logo.svg. macOS packages ICNS;
# the rasterizer uses the pinned canvas dependency, not Xcode or ImageMagick.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
if ! command -v iconutil >/dev/null 2>&1; then
  echo "Error: build:icons requires macOS iconutil to assemble the ICNS file." >&2
  exit 1
fi
TMP_DIR=$(mktemp -d)
trap 'rmdir "$TMP_DIR/kondex.iconset" "$TMP_DIR" 2>/dev/null || true' EXIT
node "$PROJECT_DIR/config/scripts/render-kondex-icons.mjs" "$TMP_DIR/kondex.iconset"
iconutil -c icns "$TMP_DIR/kondex.iconset" -o "$PROJECT_DIR/resources/build/icon.icns"
# Only remove the ten files generated for this temporary iconset.
for size in 16 32 128 256 512; do
  unlink "$TMP_DIR/kondex.iconset/icon_${size}x${size}.png"
  unlink "$TMP_DIR/kondex.iconset/icon_${size}x${size}@2x.png"
done
echo "Generated Kondex app, development, Windows, and menu-bar icons."
