#!/bin/bash
set -euo pipefail
LABEL="com.diegocaycho.tagscc"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
rm -f "$PLIST"
echo "✓ desinstalado. El progreso en state/progress.json se conserva."
