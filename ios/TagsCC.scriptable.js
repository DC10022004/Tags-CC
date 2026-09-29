// Tags CC — widget para Scriptable (iOS)
// Variables used by Scriptable: these must stay at the very top of the file.
// icon-color: deep-gray; icon-glyph: tag;
//
// Muestra el mismo concepto de Claude Code que la tarjeta de la Mac, sin servidor:
// ambos clientes CALCULAN cuál toca con la misma función determinista (docs/SDD.md §2).
//
// Instalación: ios/INSTALACION-IPHONE.md

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

// URL raw del corpus. Cámbiala por la de tu repo tras publicarlo.
const RAW_URL = "https://raw.githubusercontent.com/DC10022004/Tags-CC/main/dist/tags.json";

const INTERVAL_HOURS = 4;     // debe coincidir con intervalHours de la Mac
const CACHE_NAME = "tagscc-corpus.json";

// ─────────────────────────────────────────────────────────────────────────────
// Selección determinista — espejo exacto de macos/Sources/Selector.swift
// Cualquier cambio acá hay que replicarlo allá, o los dos dispositivos mostrarán
// tags distintos sin que nada falle visiblemente. Vectores en docs/SDD.md §2.2.
// ─────────────────────────────────────────────────────────────────────────────

function fnv1a32(s) {
  let h = 0x811c9dc5;
  for (const b of utf8Bytes(s)) {
    h ^= b;
    // Math.imul es obligatorio: con `*` el producto excede los 53 bits exactos de un
    // double y el hash se corrompe en silencio.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// UTF-8 a mano: Scriptable no trae TextEncoder. Debe dar los mismos bytes que
// String.utf8 en Swift; los vectores de conformidad de validate.mjs lo comprueban.
function utf8Bytes(s) {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function localDateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function slotOf(d, intervalHours) {
  const minutes = d.getHours() * 60 + d.getMinutes();
  return Math.floor(minutes / (intervalHours * 60));
}

function pick(version, date, intervalHours, count) {
  if (!count) return null;
  const s = slotOf(date, intervalHours);
  return fnv1a32(`${version}|${localDateKey(date)}|${s}`) % count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Corpus: red con respaldo en caché
// ─────────────────────────────────────────────────────────────────────────────

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.cacheDirectory(), CACHE_NAME);
}

async function loadCorpus() {
  const fm = FileManager.local();
  const path = cachePath();

  try {
    const req = new Request(RAW_URL);
    req.timeoutInterval = 10;
    const data = await req.loadJSON();
    if (data && Array.isArray(data.tags) && data.tags.length) {
      fm.writeString(path, JSON.stringify(data));
      return { corpus: data, offline: false };
    }
  } catch (e) {
    // Sin red o URL mal configurada: se sigue con la caché. Un widget nunca debe
    // quedarse en blanco por no tener señal (docs/SDD.md §6).
  }

  if (fm.fileExists(path)) {
    try {
      return { corpus: JSON.parse(fm.readString(path)), offline: true };
    } catch (e) { /* caché corrupta: cae al estado de primer arranque */ }
  }
  return { corpus: null, offline: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentación
// ─────────────────────────────────────────────────────────────────────────────

const FG = Color.dynamic(new Color("#1a1918"), new Color("#f1efe9"));
const MUTED = Color.dynamic(new Color("#5e5d59"), new Color("#b8b5ad"));

function setupWidget(w, family) {
  // En la pantalla de bloqueo el fondo lo pone el sistema: ponerle uno propio se ve mal.
  if (!String(family).startsWith("accessory")) {
    w.backgroundColor = Color.dynamic(new Color("#faf9f5"), new Color("#24231f"));
  }
  w.setPadding(family === "accessoryRect" ? 0 : 12, family === "accessoryRect" ? 0 : 14,
               family === "accessoryRect" ? 0 : 12, family === "accessoryRect" ? 0 : 14);
}

function addText(w, text, { size, color = FG, bold = false, lines = 0 }) {
  const t = w.addText(text);
  t.font = bold ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  if (lines) t.lineLimit = lines;
  t.minimumScaleFactor = 0.85;
  return t;
}

function buildWidget(tag, family, offline) {
  const w = new ListWidget();
  setupWidget(w, family);

  if (!tag) {
    addText(w, "Tags CC", { size: 13, bold: true });
    addText(w, "Abre el script para descargar el corpus.", { size: 11, color: MUTED, lines: 2 });
    return w;
  }

  if (family === "accessoryInline") {
    addText(w, tag.term, { size: 12 });
    return w;
  }

  if (family === "accessoryCircular") {
    addText(w, tag.term.split(/\s+/)[0].slice(0, 8), { size: 11, bold: true, lines: 2 });
    return w;
  }

  if (family === "accessoryRect") {
    // Pantalla de bloqueo: solo term + summary. Por esto el summary tiene un máximo
    // duro de 120 caracteres (docs/SDD.md §1.1).
    addText(w, tag.term, { size: 13, bold: true, lines: 1 });
    addText(w, tag.summary, { size: 11, lines: 3 });
    return w;
  }

  // small / medium / large
  const header = w.addStack();
  header.centerAlignContent();
  const h = header.addText(tag.term);
  h.font = Font.semiboldRoundedSystemFont(family === "small" ? 14 : 17);
  h.textColor = FG;
  h.lineLimit = 2;
  header.addSpacer();
  if (offline) {
    const o = header.addText("sin conexión");
    o.font = Font.systemFont(8);
    o.textColor = MUTED;
  }

  w.addSpacer(4);
  addText(w, `${tag.category} · ${tag.level}`, { size: 9, color: MUTED, lines: 1 });
  w.addSpacer(6);
  addText(w, tag.summary, { size: family === "small" ? 11 : 13, lines: family === "small" ? 4 : 3 });

  if (family !== "small") {
    w.addSpacer(6);
    addText(w, tag.why, { size: 11, color: MUTED, lines: family === "large" ? 4 : 2 });
  }
  if (family === "large" && tag.body) {
    w.addSpacer(8);
    addText(w, tag.body, { size: 11, color: MUTED, lines: 8 });
  }

  w.addSpacer();
  return w;
}

/// Vista completa al abrir el script desde la app.
function presentFull(tag, corpus, offline) {
  const table = new UITable();
  table.showSeparators = true;

  const title = new UITableRow();
  title.isHeader = true;
  title.addText(tag.term, `${tag.category} · ${tag.level}`);
  table.addRow(title);

  const add = (label, value) => {
    if (!value) return;
    const r = new UITableRow();
    r.height = Math.max(44, 22 + Math.ceil(value.length / 42) * 18);
    r.addText(label, value);
    table.addRow(r);
  };

  add("Resumen", tag.summary);
  add("Qué es", tag.body);
  if (tag.example) add("Ejemplo", tag.example);
  add("Para qué sirve", tag.why);

  const src = new UITableRow();
  src.addText("Ver la documentación →");
  src.onSelect = () => Safari.open(tag.source);
  table.addRow(src);

  const meta = new UITableRow();
  meta.addText(`v${corpus.version} · ${corpus.count} tarjetas${offline ? " · sin conexión" : ""}`);
  table.addRow(meta);

  table.present();
}

// ─────────────────────────────────────────────────────────────────────────────

const { corpus, offline } = await loadCorpus();
const now = new Date();
let tag = null;
if (corpus) {
  const i = pick(corpus.version, now, INTERVAL_HOURS, corpus.tags.length);
  if (i !== null) tag = corpus.tags[i];
}

if (config.runsInWidget) {
  const w = buildWidget(tag, config.widgetFamily, offline);
  // Se pide refresco al inicio de la próxima ventana horaria. iOS decide cuándo refresca
  // de verdad; por eso la selección va por ventana horaria y no por evento: un refresco
  // tardío igual muestra el tag correcto para el momento en que ocurra.
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours((slotOf(now, INTERVAL_HOURS) + 1) * INTERVAL_HOURS);
  w.refreshAfterDate = next;
  Script.setWidget(w);
} else if (tag) {
  presentFull(tag, corpus, offline);
} else {
  const a = new Alert();
  a.title = "Sin corpus";
  a.message = `No se pudo descargar ni encontrar en caché.\n\nRevisa que RAW_URL apunte a tu repo:\n${RAW_URL}`;
  a.addAction("OK");
  await a.present();
}
Script.complete();
