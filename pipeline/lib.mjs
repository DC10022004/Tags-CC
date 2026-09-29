// Utilidades compartidas del pipeline. Node 22, cero dependencias (ver CLAUDE.md, invariante 3).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Parser de YAML mínimo y deliberado: cubre solo el subconjunto que usan las tarjetas
 * (claves de primer nivel, strings, listas en línea `[a, b]` y bloques `|`).
 * No es YAML completo. Si una tarjeta necesita más, se simplifica la tarjeta —
 * no se agrega un parser. Ver SDD §5.
 */
export function parseYaml(text, file = "<inline>") {
  const out = {};
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim() || line.trimStart().startsWith("#")) { i++; continue; }
    if (/^\s/.test(line)) throw new Error(`${file}:${i + 1}: indentación inesperada (¿clave anidada? no está soportada)`);

    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s?(.*)$/);
    if (!m) throw new Error(`${file}:${i + 1}: no se pudo leer la línea: ${line}`);
    const [, key, rawValue] = m;
    const value = rawValue.trim();
    i++;

    if (value === "|" || value === "|-") {
      // Bloque literal: todo lo indentado que sigue, sin la indentación base.
      const block = [];
      let indent = null;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === "") { block.push(""); i++; continue; }
        const lead = l.match(/^(\s*)/)[1].length;
        if (lead === 0) break;
        if (indent === null) indent = lead;
        block.push(l.slice(indent));
        i++;
      }
      while (block.length && block.at(-1) === "") block.pop();
      out[key] = block.join("\n") + (value === "|" ? "\n" : "");
      continue;
    }

    if (value.startsWith("[")) {
      if (!value.endsWith("]")) throw new Error(`${file}: la lista de '${key}' debe caber en una línea`);
      const inner = value.slice(1, -1).trim();
      out[key] = inner ? inner.split(",").map((s) => unquote(s.trim())) : [];
      continue;
    }

    if (value === "") { out[key] = ""; continue; }
    out[key] = unquote(value);
  }
  return out;
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

/**
 * FNV-1a de 32 bits. Especificación normativa en SDD §2.2; debe coincidir bit a bit con
 * Selector.swift y con ios/TagsCC.scriptable.js.
 * Math.imul es obligatorio: con `*` el producto excede los 53 bits exactos de un double
 * y el hash se corrompe en silencio.
 */
export function fnv1a32(s) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(s, "utf8")) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const CONFORMANCE_VECTORS = [
  ["", 0x811c9dc5],
  ["a", 0xe40c292c],
  ["tags-cc", 0x4022b04d],
  ["2026-09-28.1|2026-09-28|3", 0x35ea280f],
];

// fileURLToPath, no .pathname: la carpeta del proyecto tiene un espacio y .pathname lo
// devuelve percent-encoded ("Tags%20CC"), lo que rompe todas las rutas.
export const ROOT = fileURLToPath(new URL("..", import.meta.url));

export function loadTaxonomy() {
  // taxonomy.yaml usa listas de objetos, que el parser mínimo no soporta a propósito.
  // Se extrae con regex: es el único archivo con esa forma y no crece en complejidad.
  const raw = readFileSync(join(ROOT, "content/taxonomy.yaml"), "utf8");
  const categories = [...raw.matchAll(/^\s*-\s*id:\s*(\S+)/gm)].map((m) => m[1]);
  const levelsLine = raw.match(/^levels:\s*\[(.*)\]\s*$/m);
  const levels = levelsLine ? levelsLine[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!categories.length) throw new Error("taxonomy.yaml: no se encontró ninguna categoría");
  if (!levels.length) throw new Error("taxonomy.yaml: no se encontró ningún nivel");
  return { categories, levels };
}

export function loadCards() {
  const dir = join(ROOT, "content/tags");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => ({ file: f, data: parseYaml(readFileSync(join(dir, f), "utf8"), f) }));
}

export const SUMMARY_MAX = 120;   // ancho útil del widget accessoryRect de iOS
export const REQUIRED = ["id", "term", "category", "level", "summary", "body", "why", "source", "updated"];
