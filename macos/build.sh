#!/bin/bash
# Compila TagsCC.app sin Xcode, con swiftc y el SDK de Command Line Tools (ADR 0004).
# Este script hace a mano lo que Xcode haría solo: el bundle, el Info.plist y la firma.
set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT="$(cd .. && pwd)"
BUILD="build"
APP="$BUILD/TagsCC.app"
BUNDLE_ID="com.diegocaycho.tagscc"

SDK="$(xcrun --show-sdk-path)"
[ -d "$SDK" ] || { echo "✗ no se encontró el SDK de macOS (xcrun --show-sdk-path)"; exit 1; }

echo "▸ limpiando"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "▸ compilando Swift"
swiftc \
  -sdk "$SDK" \
  -target arm64-apple-macos13.0 \
  -O \
  -framework AppKit -framework SwiftUI -framework Foundation \
  -o "$APP/Contents/MacOS/TagsCC" \
  Sources/*.swift

echo "▸ escribiendo Info.plist"
# TCCCorpusPath y TCCRepoRoot dejan la app apuntando al repo, para que editar una
# tarjeta y correr build.mjs se vea sin recompilar la app.
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>TagsCC</string>
  <key>CFBundleDisplayName</key><string>Tags CC</string>
  <key>CFBundleExecutable</key><string>TagsCC</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>TCCCorpusPath</key><string>$REPO_ROOT/dist/tags.json</string>
  <key>TCCRepoRoot</key><string>$REPO_ROOT</string>
</dict>
</plist>
PLIST

# Copia de respaldo dentro del bundle: si el repo se mueve, la app sigue teniendo corpus.
if [ -f "$REPO_ROOT/dist/tags.json" ]; then
  cp "$REPO_ROOT/dist/tags.json" "$APP/Contents/Resources/tags.json"
else
  echo "  aviso: no existe dist/tags.json — corre 'node pipeline/build.mjs' primero"
fi

echo "▸ firmando (ad-hoc, solo uso local)"
codesign --force --sign - --timestamp=none "$APP" >/dev/null 2>&1 \
  || echo "  aviso: la firma ad-hoc falló; la app igual corre localmente"

echo "✓ $APP"
