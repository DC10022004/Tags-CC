#!/usr/bin/env node
// Valida content/ contra el schema del SDD §1.1. No escribe nada.
// Sale con 1 si algo falla, para que se pueda encadenar en un hook o en CI.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCards, loadTaxonomy, fnv1a32, CONFORMANCE_VECTORS, SUMMARY_MAX, REQUIRED, ROOT } from "./lib.mjs";

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

// 1. Vectores de conformidad de fnv1a32 (SDD §2.2). Si esto falla, Mac e iPhone
//    mostrarían tags distintos, así que se comprueba antes que el contenido.
for (const [input, expected] of CONFORMANCE_VECTORS) {
  const got = fnv1a32(input);
  if (got !== expected) {
    err("fnv1a32", `${JSON.stringify(input)} dio 0x${got.toString(16)}, se esperaba 0x${expected.toString(16)}`);
  }
}

// 2. El selector del cliente de iOS debe coincidir con el de referencia. Es un contrato
//    duplicado (ADR 0003) y una divergencia no falla sola: los dos dispositivos
//    simplemente mostrarían tags distintos. Se importan las funciones del archivo real,
//    no una copia, porque probar una copia no probaría nada.
try {
  const src = readFileSync(join(ROOT, "ios/TagsCC.scriptable.js"), "utf8");
  const start = src.indexOf("function fnv1a32");
  const end = src.indexOf("// \u2500", start);
  if (start < 0 || end < 0) throw new Error("no se encontró el bloque del selector");
  const ios = await import("data:text/javascript," +
    encodeURIComponent(src.slice(start, end) + "\nexport { fnv1a32, pick };"));

  for (const [input, expected] of CONFORMANCE_VECTORS) {
    const got = ios.fnv1a32(input);
    if (got !== expected) err("ios/TagsCC.scriptable.js", `fnv1a32(${JSON.stringify(input)}) dio 0x${got.toString(16)}, se esperaba 0x${expected.toString(16)}`);
  }
  // Un día completo de ventanas horarias, comparado contra la implementación de referencia.
  for (const [h, m] of [[0, 10], [3, 59], [4, 0], [9, 30], [13, 0], [19, 45], [23, 59]]) {
    const d = new Date(2026, 8, 28, h, m, 0);
    const slot = Math.floor((h * 60 + m) / 240);
    const reference = fnv1a32(`2026-09-28.1|2026-09-28|${slot}`) % 12;
    const got = ios.pick("2026-09-28.1", d, 4, 12);
    if (got !== reference) {
      err("ios/TagsCC.scriptable.js", `pick a las ${h}:${String(m).padStart(2, "0")} dio ${got}, la referencia da ${reference} — Mac e iPhone mostrarían tags distintos`);
    }
  }
  if (ios.pick("v", new Date(), 4, 0) !== null) err("ios/TagsCC.scriptable.js", "pick con corpus vacío debe devolver null");
} catch (e) {
  err("ios/TagsCC.scriptable.js", `no se pudo verificar el selector: ${e.message}`);
}

const { categories, levels } = loadTaxonomy();
const cards = loadCards();
const ids = new Set();

for (const { file, data: c } of cards) {
  const at = `content/tags/${file}`;

  for (const k of REQUIRED) {
    if (!c[k] || String(c[k]).trim() === "") err(at, `falta el campo obligatorio '${k}'`);
  }
  if (!c.id) continue;

  if (`${c.id}.yaml` !== file) err(at, `el id '${c.id}' no coincide con el nombre del archivo`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(c.id)) err(at, `id '${c.id}' no es kebab-case con al menos dos partes`);
  if (ids.has(c.id)) err(at, `id duplicado '${c.id}'`);
  ids.add(c.id);

  if (c.category && !categories.includes(c.category)) err(at, `categoría desconocida '${c.category}'`);
  if (c.level && !levels.includes(c.level)) err(at, `nivel desconocido '${c.level}'`);

  if (c.summary) {
    if (c.summary.length > SUMMARY_MAX) {
      err(at, `summary tiene ${c.summary.length} chars, el máximo es ${SUMMARY_MAX} (es el ancho del widget de iOS; parte la tarjeta en dos)`);
    }
    if (c.summary.includes("\n")) err(at, "summary debe ser una sola línea");
  }
  if (c.term && c.term.length > 40) err(at, `term tiene ${c.term.length} chars, el máximo es 40`);
  if (c.why && c.why.length > 200) err(at, `why tiene ${c.why.length} chars, el máximo es 200`);

  if (c.body) {
    const n = c.body.trim().split("\n").filter((l) => l.trim()).length;
    if (n < 3) warnings.push(`${at}: body tiene ${n} línea(s); la guía editorial pide 3–6`);
    if (n > 8) warnings.push(`${at}: body tiene ${n} líneas; la guía editorial pide 3–6`);
  }

  if (c.source && !/^https:\/\//.test(c.source)) err(at, `source debe ser una URL https: '${c.source}'`);
  if (c.updated && !/^\d{4}-\d{2}-\d{2}$/.test(c.updated)) err(at, `updated debe ser AAAA-MM-DD: '${c.updated}'`);
}

// 2. Integridad referencial de 'related'. Se comprueba al final, cuando ya se
//    conocen todos los ids.
for (const { file, data: c } of cards) {
  for (const r of c.related ?? []) {
    if (!ids.has(r)) err(`content/tags/${file}`, `related apunta a '${r}', que no existe`);
    if (r === c.id) err(`content/tags/${file}`, "related se apunta a sí misma");
  }
}

for (const w of warnings) console.warn(`  aviso  ${w}`);
if (errors.length) {
  console.error(`\n✗ ${errors.length} error(es):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`✓ ${cards.length} tarjetas válidas · ${categories.length} categorías · selector Swift/JS/iOS en acuerdo`);
if (warnings.length) console.log(`  (${warnings.length} aviso(s), no bloquean el build)`);
