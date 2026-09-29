#!/bin/bash
# Instala TagsCC como LaunchAgent residente del usuario.
set -euo pipefail
cd "$(dirname "$0")"

LABEL="com.diegocaycho.tagscc"
APP="$(cd .. && pwd)/macos/build/TagsCC.app"
BIN="$APP/Contents/MacOS/TagsCC"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

[ -x "$BIN" ] || { echo "✗ no existe $BIN — corre ./macos/build.sh primero"; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

# KeepAlive y no StartInterval: el agente tiene que estar residente para escuchar el
# desbloqueo de pantalla, no despertar cada tantas horas (SDD §3.6).
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$BIN</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/tagscc.log</string>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/tagscc.log</string>
</dict>
</plist>
PLISTEOF

# bootout antes de bootstrap: recargar un agente ya cargado falla si no se descarga.
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"

echo "✓ instalado y corriendo. Busca el icono de etiqueta en la barra de menú."
echo "  log:        tail -f ~/Library/Logs/tagscc.log"
echo "  disparar:   launchctl kickstart -k gui/$UID/$LABEL"
echo "  desinstalar: ./macos/uninstall.sh"
