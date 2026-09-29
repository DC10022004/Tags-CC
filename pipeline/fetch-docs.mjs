#!/usr/bin/env node
// Cachea los docs oficiales de Claude Code como markdown en .cache/docs/.
//
// Se parte del sitemap y no de una lista de rutas fijas: los docs ya se movieron una vez
// (docs.anthropic.com -> code.claude.com) y volverán a moverse. El sitemap es lo único
// que se mantiene al día solo.
//
// Sobre el caché: se intentó revalidación HTTP y no es posible. El servidor no manda
// `ETag`, y su `last-modified` es la hora de cada petición porque las páginas se generan
// al vuelo. Así que el caché es local: no se vuelve a pedir una página descargada hace
// menos de --max-age horas, y el hash del contenido distingue lo que de verdad cambió
// de lo que solo se volvió a bajar igual.
//
//   node pipeline/fetch-docs.mjs                # usa el caché (24 h)
//   node pipeline/fetch-docs.mjs --force        # ignora el caché
//   node pipeline/fetch-docs.mjs --max-age 1    # revalida lo de más de 1 hora
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ROOT } from "./lib.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const maxAgeHours = Number(args[args.indexOf("--max-age") + 1]) || 24;

const SITEMAP = "https://code.claude.com/docs/sitemap.xml";
const CACHE = join(ROOT, ".cache/docs");
const INDEX = join(ROOT, ".cache/index.json");
const CONCURRENCY = 8;

mkdirSync(CACHE, { recursive: true });
const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : {};

console.log("▸ leyendo el sitemap");
const xml = await (await fetch(SITEMAP)).text();
const slugs = [...new Set([...xml.matchAll(/docs\/en\/([a-z0-9/-]+)/g)].map((m) => m[1]))].sort();
console.log(`  ${slugs.length} páginas · caché ${force ? "ignorado" : maxAgeHours + " h"}`);

let downloaded = 0, changed = 0, skipped = 0, failed = 0;

function fresh(entry, file) {
  if (force || !entry?.fetched_at || !existsSync(file)) return false;
  const ageHours = (Date.now() - Date.parse(entry.fetched_at)) / 3_600_000;
  return ageHours < maxAgeHours;
}

async function grab(slug) {
  const url = `https://code.claude.com/docs/en/${slug}.md`;
  const file = join(CACHE, slug.replace(/\//g, "__") + ".md");

  if (fresh(index[slug], file)) { skipped++; return; }

  try {
    const res = await fetch(url);
    if (!res.ok) { failed++; console.warn(`  ✗ ${slug}: HTTP ${res.status}`); return; }
    const text = await res.text();
    const sha = createHash("sha256").update(text).digest("hex");
    downloaded++;

    const isNew = index[slug]?.sha !== sha;
    if (isNew) { writeFileSync(file, text); changed++; }

    index[slug] = {
      url,
      sha,
      bytes: text.length,
      title: (text.match(/^#\s+(.+)$/m) ?? [])[1] ?? slug,
      headings: [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim()),
      fetched_at: new Date().toISOString(),
      // changed_at solo se mueve cuando el contenido cambió de verdad: es lo que permite
      // saber qué tarjetas hay que re-auditar tras una actualización de los docs.
      changed_at: isNew ? new Date().toISOString() : index[slug].changed_at,
    };
  } catch (e) {
    failed++;
    console.warn(`  ✗ ${slug}: ${e.message}`);
  }
}

const queue = [...slugs];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) await grab(queue.shift());
}));

writeFileSync(INDEX, JSON.stringify(index, null, 1) + "\n");
console.log(`✓ ${downloaded} descargadas (${changed} con cambios) · ${skipped} desde caché · ${failed} fallidas`);
