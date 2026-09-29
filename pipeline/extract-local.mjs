#!/usr/bin/env node
// Inventaría ~/.claude para saber QUÉ ENSEÑAR: qué skills, plugins, hooks y ajustes
// ya usa Diego, de modo que el corpus cubra su instalación real y no solo lo genérico.
//
// Precaución deliberada (el repo es público): se registran NOMBRES y CLAVES, nunca
// valores de configuración. Nada de lo que se lee acá entra en dist/.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ROOT } from "./lib.mjs";

const CLAUDE = join(homedir(), ".claude");
const OUT = join(ROOT, ".cache/local-inventory.json");
mkdirSync(join(ROOT, ".cache"), { recursive: true });

const ls = (p, kind = "dir") => {
  if (!existsSync(p)) return [];
  try {
    return readdirSync(p).filter((n) => {
      if (n.startsWith(".")) return false;
      const s = statSync(join(p, n));
      return kind === "dir" ? s.isDirectory() : s.isFile();
    }).sort();
  } catch { return []; }
};

const inventory = {
  generated_at: new Date().toISOString(),
  nota: "Solo nombres y claves de configuración. Ningún valor. Ver pipeline/extract-local.mjs.",
  skills: ls(join(CLAUDE, "skills")),
  plugins: ls(join(CLAUDE, "plugins")),
  agents: ls(join(CLAUDE, "agents"), "file").map((f) => f.replace(/\.md$/, "")),
  commands: ls(join(CLAUDE, "commands"), "file").map((f) => f.replace(/\.md$/, "")),
  settings_keys: [],
  hooks_events: [],
  tiene_claude_md: existsSync(join(CLAUDE, "CLAUDE.md")),
};

// Del settings.json solo se leen las CLAVES presentes, jamás sus valores.
const settingsPath = join(CLAUDE, "settings.json");
if (existsSync(settingsPath)) {
  try {
    const s = JSON.parse(readFileSync(settingsPath, "utf8"));
    inventory.settings_keys = Object.keys(s).sort();
    if (s.hooks && typeof s.hooks === "object") inventory.hooks_events = Object.keys(s.hooks).sort();
  } catch {
    console.warn("  aviso  ~/.claude/settings.json no es JSON válido; se omite");
  }
}

writeFileSync(OUT, JSON.stringify(inventory, null, 1) + "\n");

const n = (a) => a.length;
console.log("✓ inventario local en .cache/local-inventory.json");
console.log(`  skills: ${n(inventory.skills)} · plugins: ${n(inventory.plugins)} · agentes: ${n(inventory.agents)} · comandos: ${n(inventory.commands)}`);
console.log(`  claves en settings.json: ${n(inventory.settings_keys)} · eventos de hook configurados: ${n(inventory.hooks_events)}`);
if (inventory.hooks_events.length) console.log(`  hooks activos: ${inventory.hooks_events.join(", ")}`);
