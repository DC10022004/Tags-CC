#!/usr/bin/env node
// Valida content/ contra el schema del SDD §1.1. No escribe nada.
// Sale con 1 si algo falla, para que se pueda encadenar en un hook o en CI.
import { loadCards, loadTaxonomy, fnv1a32, CONFORMANCE_VECTORS, SUMMARY_MAX, REQUIRED } from "./lib.mjs";

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
console.log(`✓ ${cards.length} tarjetas válidas · ${categories.length} categorías · vectores fnv1a32 correctos`);
if (warnings.length) console.log(`  (${warnings.length} aviso(s), no bloquean el build)`);
