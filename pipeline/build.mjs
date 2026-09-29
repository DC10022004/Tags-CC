#!/usr/bin/env node
// content/ -> dist/tags.json + dist/manifest.json  (contrato del SDD §1.2 y §1.3)
// Determinista: dos builds del mismo contenido producen el mismo hash y un diff vacío.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { loadCards, ROOT } from "./lib.mjs";

const SCHEMA = 1;
const FIELDS = ["id", "term", "category", "level", "summary", "body", "example", "why", "source", "related", "updated"];

// El build no valida por su cuenta: delega en validate.mjs para que exista una sola
// definición del schema y sea imposible publicar algo que el validador rechazaría.
try {
  execFileSync(process.execPath, [join(ROOT, "pipeline/validate.mjs")], { stdio: "inherit" });
} catch {
  console.error("\n✗ build abortado: la validación falló. Corrige el contenido y vuelve a intentar.");
  process.exit(1);
}

// Orden por id: es parte del contrato, porque la selección determinista usa el índice
// del arreglo (SDD §1.2 y ADR 0003). Reordenar cambiaría qué tag se muestra.
const tags = loadCards()
  .map(({ data }) => {
    const t = {};
    for (const f of FIELDS) {
      if (data[f] === undefined || data[f] === "") continue;
      t[f] = typeof data[f] === "string" ? data[f].trim() : data[f];
    }
    return t;
  })
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// El hash cubre solo el contenido, nunca la marca de tiempo: así un build sin cambios
// reales no produce un diff en Git (ADR 0002).
const canonical = JSON.stringify(tags);
const hash = createHash("sha256").update(canonical).digest("hex");

const distDir = join(ROOT, "dist");
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

// La versión es AAAA-MM-DD.N y también es semilla de selección. Se conserva la del
// manifiesto anterior mientras el contenido no cambie, para no remezclar la baraja sin
// motivo; el contador sube cuando hay un cambio real en el mismo día.
const manifestPath = join(distDir, "manifest.json");
// Fecha LOCAL, no UTC: el SDD usa el día local para las ventanas horarias, y una versión
// fechada un día adelante confunde al revisar el historial.
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
let version = `${today}.1`;
if (existsSync(manifestPath)) {
  try {
    const prev = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (prev.hash === hash && prev.version) {
      version = prev.version;                       // nada cambió: misma versión
    } else if (prev.version?.startsWith(today)) {
      version = `${today}.${Number(prev.version.split(".").pop() || 0) + 1}`;
    }
  } catch {
    console.warn("  aviso  manifest.json anterior ilegible; se empieza en .1");
  }
}

const corpus = { schema: SCHEMA, version, count: tags.length, tags };
writeFileSync(join(distDir, "tags.json"), JSON.stringify(corpus, null, 1) + "\n");
writeFileSync(manifestPath, JSON.stringify(
  { schema: SCHEMA, version, count: tags.length, hash, generated_at: new Date().toISOString() },
  null, 1) + "\n");

console.log(`✓ dist/tags.json — ${tags.length} tarjetas · versión ${version}`);
console.log(`  hash ${hash.slice(0, 16)}…`);
