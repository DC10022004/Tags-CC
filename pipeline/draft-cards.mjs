#!/usr/bin/env node
// Propone borradores de tarjetas a partir del caché de docs y del inventario local.
//
// NO publica: escribe a content/drafts/ (gitignored) con el contexto necesario para que
// una persona —o Claude bajo revisión— redacte el español. Es el invariante 6 de
// CLAUDE.md: la máquina prepara, no publica.
//
//   node pipeline/draft-cards.mjs             # borradores de lo que falta, por prioridad
//   node pipeline/draft-cards.mjs --limit 15
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadCards } from "./lib.mjs";

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || 25;

const INDEX = join(ROOT, ".cache/index.json");
const INVENTORY = join(ROOT, ".cache/local-inventory.json");
const DRAFTS = join(ROOT, "content/drafts");

if (!existsSync(INDEX)) {
  console.error("✗ falta .cache/index.json — corre primero: node pipeline/fetch-docs.mjs");
  process.exit(1);
}
const index = JSON.parse(readFileSync(INDEX, "utf8"));
const inventory = existsSync(INVENTORY) ? JSON.parse(readFileSync(INVENTORY, "utf8")) : null;

// Mapa slug -> categoría del proyecto. Lo que no esté acá se propone igual, con la
// categoría en blanco para que la decida quien cure.
const CATEGORY_OF = {
  hooks: "hooks", "hooks-guide": "hooks",
  skills: "skills", commands: "skills",
  "sub-agents": "subagentes", "agent-teams": "subagentes",
  mcp: "mcp", "mcp-quickstart": "mcp", "managed-mcp": "mcp",
  permissions: "permisos", "permission-modes": "permisos", sandboxing: "permisos",
  security: "permisos", "sandbox-environments": "permisos",
  settings: "configuracion", "settings-reference": "configuracion", "env-vars": "configuracion",
  "model-config": "configuracion", keybindings: "configuracion", "terminal-config": "configuracion",
  memory: "contexto", "context-window": "contexto", checkpointing: "contexto",
  "cli-reference": "cli", "interactive-mode": "cli", sessions: "cli", fullscreen: "cli",
  "output-styles": "cli", statusline: "cli", "voice-dictation": "cli", "fast-mode": "cli",
  "best-practices": "workflow", "common-workflows": "workflow", worktrees: "workflow",
  "code-review": "workflow", "large-codebases": "workflow", workflows: "workflow",
  "claude-code-on-the-web": "plataforma", "vs-code": "plataforma", jetbrains: "plataforma",
  desktop: "plataforma", headless: "plataforma", "github-actions": "plataforma",
  mobile: "plataforma", chrome: "plataforma", "scheduled-tasks": "plataforma",
  routines: "plataforma", "remote-control": "plataforma", artifacts: "plataforma",
  "plugin-evals": "plataforma", glossary: "cli", quickstart: "cli", overview: "cli",
};

// Prioridad: primero lo que Diego todavía NO usa, porque es donde el aprendizaje rinde
// más. El inventario local dice qué tiene configurado.
function priority(slug) {
  const cat = CATEGORY_OF[slug];
  let p = 50;
  if (cat) p -= 20;                                   // está en una categoría conocida
  if (slug.includes("/")) p += 40;                    // agent-sdk/*: material avanzado, después
  if (["hooks", "hooks-guide"].includes(slug) && inventory && !inventory.hooks_events.length) p -= 15;
  if (["sub-agents", "agent-teams"].includes(slug) && inventory && !inventory.agents.length) p -= 15;
  if (slug === "memory" && inventory && !inventory.tiene_claude_md) p -= 15;
  if (["quickstart", "overview", "cli-reference", "best-practices", "glossary"].includes(slug)) p -= 10;
  return p;
}

// Fecha local, igual que build.mjs.
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const covered = new Set(loadCards().map(({ data }) => data.source?.replace(/^https:\/\/code\.claude\.com\/docs\/en\//, "")));
const candidates = Object.keys(index)
  .filter((slug) => !covered.has(slug))
  .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b))
  .slice(0, limit);

mkdirSync(DRAFTS, { recursive: true });
let written = 0;

for (const slug of candidates) {
  const meta = index[slug];
  const md = readFileSync(join(ROOT, ".cache/docs", slug.replace(/\//g, "__") + ".md"), "utf8");

  // El subtítulo de la página (la línea `> ...` bajo el H1) suele ser el mejor resumen
  // que existe; sirve de punto de partida para el summary.
  const subtitle = (md.match(/^#\s+.+\n+>\s*(.+)$/m) ?? [])[1] ?? "";
  const firstPara = (md.split(/^#\s+.+$/m)[1] ?? "")
    .split("\n\n").map((s) => s.trim())
    .find((s) => s && !/^[>|<#*-]/.test(s)) ?? "";   // ni citas, ni HTML, ni tablas, ni encabezados

  const cat = CATEGORY_OF[slug] ?? "";
  // Evita ids redundantes como "cli-cli-reference" cuando el slug ya empieza por su categoría.
  const leaf = slug.split("/").pop();
  const id = cat && !leaf.startsWith(cat) ? `${cat}-${leaf}` : (cat ? leaf : `sin-categoria-${leaf}`);
  const file = join(DRAFTS, `${id}.yaml`);
  if (existsSync(file)) continue;    // no se pisa un borrador que alguien ya empezó a editar

  writeFileSync(file, `# BORRADOR — no se publica hasta moverlo a content/tags/
# Redacta en español siguiendo docs/CONTENT-GUIDE.md, luego:
#   mv content/drafts/${id}.yaml content/tags/<id-definitivo>.yaml
#
# Página:    ${meta.title}
# Secciones: ${meta.headings.slice(0, 8).join(" · ")}
#
# Subtítulo oficial (buen punto de partida para el summary):
#   ${subtitle}
#
# Primer párrafo:
${firstPara.split("\n").map((l) => "#   " + l).join("\n").slice(0, 900)}

id: ${id}
term: ""
category: ${cat}
level: ""
summary: ""
body: |
  
example: |
  
why: ""
source: ${meta.url.replace(/\.md$/, "")}
related: []
updated: ${localDate()}
`);
  written++;
}

console.log(`✓ ${written} borradores en content/drafts/ (de ${candidates.length} candidatos)`);
console.log(`  cubiertas: ${covered.size} · sin cubrir: ${Object.keys(index).length - covered.size}`);
if (inventory?.hooks_events.length === 0) {
  console.log("  señal del inventario: no tienes hooks configurados — se priorizaron");
}
