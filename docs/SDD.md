# Software Design Document — Tags CC

Versión 1.0 · 2026-09-28

Este documento especifica el diseño interno. La vista de alto nivel está en
`ARCHITECTURE.md`; las decisiones y sus alternativas descartadas, en `adr/`.

---

## 1. Modelo de datos

### 1.1 Tarjeta fuente (`content/tags/<id>.yaml`)

| Campo | Tipo | Req. | Reglas |
|---|---|---|---|
| `id` | string | sí | `^[a-z0-9]+(-[a-z0-9]+)+$`, igual al nombre del archivo, único, permanente |
| `term` | string | sí | 1–40 chars. El término tal como se dice, en inglés si así se usa |
| `category` | string | sí | Debe existir en `content/taxonomy.yaml` |
| `level` | enum | sí | `basico` \| `intermedio` \| `avanzado` |
| `summary` | string | sí | **≤ 120 chars**, una sola frase, sin salto de línea |
| `body` | string | sí | 3–6 líneas. Español, segunda persona |
| `example` | string | no | Comando o snippet real y ejecutable |
| `why` | string | sí | ≤ 200 chars. Para qué sirve en el día a día |
| `source` | url | sí | Página de docs de origen |
| `related` | string[] | no | `id`s existentes. El build falla si alguno no existe |
| `updated` | date | sí | `AAAA-MM-DD` |

`summary ≤ 120` es una restricción de arquitectura: es lo único que cabe en el widget
`accessoryRect` de la pantalla de bloqueo. Si una tarjeta no se puede resumir en 120
caracteres, el concepto está mal delimitado y hay que partirlo en dos tarjetas.

### 1.2 Corpus compilado (`dist/tags.json`)

Contrato entre el pipeline y los dos clientes. **Cambiarlo es un cambio de contrato**:
hay que actualizar las dos implementaciones de cliente.

```json
{
  "schema": 1,
  "version": "2026-09-28.1",
  "count": 8,
  "tags": [ { "id": "...", "term": "...", "...": "..." } ]
}
```

- `tags` va **ordenado por `id`** ascendente. El orden es parte del contrato: la
  selección determinista depende del índice, así que un reordenamiento cambiaría qué
  tag se muestra.
- `version` es `AAAA-MM-DD.N` y también se usa como semilla de selección: al publicar
  una versión nueva, la baraja se remezcla.

### 1.3 Manifiesto (`dist/manifest.json`)

`version`, `count`, `schema`, `generated_at` y `hash` (SHA-256 del contenido canónico de
`tags`). El `hash` **excluye** `generated_at`, para que dos builds del mismo contenido
den el mismo hash y el diff de Git quede vacío cuando nada cambió.

### 1.4 Estado local (`state/progress.json`, gitignored)

```json
{
  "schema": 1,
  "lastShownAt": "2026-09-28T14:03:11Z",
  "entries": { "hooks-pretooluse": { "box": 2, "seen": 5, "lastSeen": "...", "dueAt": "..." } }
}
```

Nunca se commitea y nunca es necesario: si se borra, el sistema arranca desde cero sin
errores.

---

## 2. Selección determinista

Requisito: Mac e iPhone muestran el mismo tag en la misma ventana horaria, sin servidor.

### 2.1 Ventana horaria (`slot`)

El día se parte en ventanas de `intervalHours` (default 4) desde medianoche **local**:

```
slot = floor(minutosDesdeMedianocheLocal / (intervalHours * 60))
```

Con 4 h → 6 ventanas al día. La hora local, no UTC: si Diego viaja, el ciclo sigue su
día, no el de Greenwich. El costo es que cruzar un huso reordena la ventana en curso, lo
cual es irrelevante para el propósito.

### 2.2 Función de selección

```
pick(version, fechaLocal, slot, count) -> índice

  clave  = "{version}|{AAAA-MM-DD}|{slot}"
  h      = fnv1a32(clave)          // hash de 32 bits, determinista y portable
  índice = h % count
```

Se eligió **FNV-1a de 32 bits** porque se implementa en 6 líneas idénticas en Swift y
en JavaScript, sin dependencias y sin ambigüedad de aritmética de 64 bits. No necesita
ser criptográfico: solo necesita dispersar y ser reproducible.

Pseudocódigo normativo (ambas implementaciones deben coincidir bit a bit):

```
fnv1a32(s):
    h = 0x811c9dc5
    para cada byte b de utf8(s):
        h = h XOR b
        h = (h * 0x01000193) mod 2^32
    devolver h
```

**Vectores de conformidad** (normativos, verificados el 2026-09-28). Las tres
implementaciones —JS, Swift y el validador— deben reproducirlos exactamente:

| Entrada | `fnv1a32` |
|---|---|
| `""` | `0x811c9dc5` |
| `"a"` | `0xe40c292c` |
| `"tags-cc"` | `0x4022b04d` |
| `"2026-09-28.1\|2026-09-28\|3"` | `0x35ea280f` |

Los dos primeros son los valores canónicos de la especificación FNV-1a de 32 bits: están
en la tabla para comprobar que el algoritmo es *el correcto*, no solo que las dos
implementaciones coinciden entre sí. Si divergen, Mac e iPhone muestran tags distintos y
el requisito se rompe en silencio — de ahí que esto sea un test ejecutable
(`pipeline/validate.mjs` y un `#if DEBUG` en `Selector.swift`) y no una nota de confianza.

Cuidado de implementación: en JavaScript la multiplicación debe hacerse con
`Math.imul(h, 0x01000193) >>> 0`. Con el operador `*` el resultado excede los 53 bits
exactos de un `double` y el hash se corrompe en silencio.

### 2.3 Sesgo por progreso (solo Mac)

El iPhone usa `pick()` puro. La Mac aplica un ajuste **acotado**: si el tag elegido está
en la caja 3 (dominado) y no está vencido, la Mac avanza al siguiente índice vencido, con
un máximo de 3 saltos. El tope existe para que la Mac no se aleje demasiado del iPhone.

---

## 3. Cliente macOS

### 3.1 Componentes

| Archivo | Responsabilidad |
|---|---|
| `TagsCCApp.swift` | Entrada; agente `LSUIElement` (sin icono en Dock) |
| `Corpus.swift` | Carga y decodifica `dist/tags.json`; recarga si cambió el mtime |
| `Selector.swift` | `fnv1a32`, `slot`, `pick`, sesgo por progreso |
| `Scheduler.swift` | Los tres disparadores y el debounce |
| `CardPanel.swift` | `NSPanel` flotante + vista SwiftUI de la tarjeta |
| `MenuBarController.swift` | `NSStatusItem` y su menú |
| `Store.swift` | Lectura/escritura atómica de `state/progress.json` |

### 3.2 Disparadores

1. `DistributedNotificationCenter` → `com.apple.screenIsUnlocked`
2. `NSWorkspace.shared.notificationCenter` → `didWakeNotification`
3. `Timer` cada `intervalHours`

(1) no está documentada por Apple y puede desaparecer en una versión de macOS. Por eso
**(3) es el disparador garantizado** y (1) es una mejora: si (1) deja de existir, el
producto sigue cumpliendo "cada 3–5 horas". Esta separación es la mitigación del riesgo,
no un comentario al margen.

### 3.3 Máquina de estados

```
  ┌──────────┐  disparador   ┌──────────┐   permitido    ┌─────────┐
  │ residente├──────────────►│ debounce ├───────────────►│ visible │
  └──────────┘               └────┬─────┘                └────┬────┘
       ▲                          │ suprimido                 │ Esc / 25 s / botón
       └──────────────────────────┴───────────────────────────┘
                                                        (registra en Store)
```

**Debounce**: se suprime si `ahora - lastShownAt < minGapMinutes` (default 90). Sin esto,
desbloquear la Mac quince veces al día produciría quince pop-ups y el sistema se
volvería una molestia que Diego desinstalaría — el debounce es lo que hace viable el
disparador por desbloqueo.

"Siguiente" desde la barra de menú es **explícito** y por tanto ignora el debounce.

### 3.4 La tarjeta

`NSPanel` con `.nonactivatingPanel`, `level = .floating`, `hidesOnDeactivate = false`,
esquina inferior derecha de la pantalla activa. No roba el foco del teclado: si Diego
está escribiendo, sigue escribiendo.

Contenido: `term` (título), `category`/`level` (etiquetas), `body`, `example` en
monoespaciada, `why`. Acciones: **Lo sé** (sube de caja), **Repetir pronto** (baja a la
caja 1), **Ver fuente** (abre `source`). Esc o 25 s la cierran sin registrar juicio,
solo la vista.

La ventana **no requiere ningún permiso del sistema**. Es la razón por la que es el
mecanismo principal y las notificaciones son opcionales.

### 3.5 Compilación

`swiftc` contra el SDK de CLT, salida a `macos/build/TagsCC.app` con su `Info.plist`
(`LSUIElement=true`, `CFBundleIdentifier=com.diegocaycho.tagscc`) y `codesign -s -`
(ad-hoc). Firma ad-hoc basta para uso local; no permite distribuir ni garantiza que
`UNUserNotificationCenter` entregue notificaciones — otra razón para no depender de ellas.

### 3.6 LaunchAgent

`~/Library/LaunchAgents/com.diegocaycho.tagscc.plist`, con `RunAtLoad` y `KeepAlive`
(residente, porque debe estar escuchando el desbloqueo, no despertar por cron).
`StandardErrorPath` a `~/Library/Logs/tagscc.log` para poder diagnosticar.

---

## 4. Cliente iOS (Scriptable)

Un solo archivo, `ios/TagsCC.scriptable.js`.

1. Intenta `GET` de la URL raw del corpus con timeout de 10 s.
2. Si responde, guarda en el directorio local de Scriptable (`FileManager.local()`).
3. Si falla, carga la caché. Si no hay caché, muestra un mensaje de primer arranque.
4. Calcula `pick()` con la **misma** `fnv1a32` que Swift.
5. Renderiza según `config.widgetFamily`:

| Familia | Contenido |
|---|---|
| `accessoryRect` (lock screen) | `term` en negrita + `summary` a 2 líneas |
| `accessoryInline` | `term` solo |
| `small` / `medium` | `term`, `summary`, `why` |
| ejecutado en la app | vista completa con `body`, `example` y enlace a `source` |

`refreshAfterDate` se pide al inicio de la siguiente ventana horaria, pero **iOS decide
cuándo refresca de verdad**. El diseño lo absorbe: al usar ventanas horarias en lugar de
eventos, un refresco tardío muestra el tag correcto para el momento en que ocurra.

---

## 5. Pipeline

| Script | Entrada | Salida | Idempotente |
|---|---|---|---|
| `fetch-docs.mjs` | sitemap de code.claude.com | `.cache/docs/*.md` + `.cache/index.json` | sí (ETag) |
| `extract-local.mjs` | `~/.claude` | `.cache/local-inventory.json` | sí |
| `draft-cards.mjs` | la caché | `content/drafts/*.yaml` | sí |
| `validate.mjs` | `content/` | código de salida + reporte | sí, no escribe |
| `build.mjs` | `content/` | `dist/tags.json`, `dist/manifest.json` | sí |

`extract-local.mjs` lee `~/.claude` solo para **decidir qué enseñar** (qué skills y hooks
ya tiene Diego instalados). Registra nombres y rutas, nunca valores de configuración, y
nada de lo que lee entra al corpus publicado. Es una precaución deliberada: el repo es
público.

El parser de YAML es propio y **mínimo** por el invariante de cero dependencias: soporta
solo el subconjunto que usan las tarjetas (claves de primer nivel, strings, listas `[a, b]`
y bloques `|`). No es un YAML completo; si una tarjeta necesita más, se simplifica la
tarjeta, no se agrega un parser.

---

## 6. Modos de fallo

| Situación | Comportamiento esperado |
|---|---|
| `dist/tags.json` no existe (Mac) | La barra de menú muestra "sin corpus"; ninguna tarjeta; no crashea |
| `dist/tags.json` corrupto | Se conserva el último corpus válido en memoria; se registra en el log |
| Corpus vacío (`count == 0`) | No se dispara ninguna tarjeta; `pick` nunca divide por cero |
| Sin red (iPhone) | Usa la caché; si no hay, mensaje de primer arranque |
| `state/progress.json` corrupto | Se renombra a `.bak` y se arranca de cero |
| Permiso de notificaciones denegado | Irrelevante: la ventana sigue funcionando |
| `com.apple.screenIsUnlocked` ya no se emite | El timer de intervalo mantiene el servicio |
| `related` apunta a un `id` inexistente | **El build falla.** Es un error de contenido, no de runtime |
| `summary` > 120 chars | **El build falla** con el `id` y la cuenta de caracteres |
| Escritura de estado interrumpida | Escritura atómica (temporal + `rename`), sin estado a medias |

Las dos filas con "el build falla" son intencionales: los errores de contenido se
detienen antes de publicar, no se degradan en el cliente.

---

## 7. Configuración

`~/.config/tagscc/config.json`, todo opcional:

```json
{ "intervalHours": 4, "minGapMinutes": 90, "autoDismissSeconds": 25,
  "corpusPath": "~/Desktop/Tags CC/dist/tags.json", "levels": ["basico","intermedio","avanzado"] }
```

Si el archivo no existe se usan los defaults. Un archivo inválido se ignora con una
entrada en el log: una mala configuración no debe impedir que el sistema arranque.

---

## 8. Plan de pruebas

**Automatizable** (`node pipeline/validate.mjs`): schema de las tarjetas, unicidad de
`id`, integridad de `related`, límite de `summary`, vectores de conformidad de
`fnv1a32`, y estabilidad del hash del manifiesto entre dos builds.

**Manual en Mac**: la tarjeta se ve legible en claro y oscuro; Esc la cierra; bloquear y
desbloquear la dispara; desbloquear otra vez a los 5 minutos **no** la dispara; "Siguiente"
sí la dispara; los botones mueven la caja en `state/progress.json`.

**Manual en iPhone**: el widget de lock screen muestra término y resumen sin truncar de
forma ilegible; en modo avión sigue mostrando el cacheado; y el tag coincide con el de la
Mac en la misma ventana horaria — esta última es la prueba que valida todo el diseño sin
servidor.
