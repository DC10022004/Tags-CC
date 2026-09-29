# Bitácora

Registro cronológico **append-only**: se agregan entradas nuevas arriba, no se reescriben
las viejas. Si una decisión se revierte, se escribe una entrada nueva que lo diga; la
entrada original se queda como está, porque el valor de la bitácora es saber *qué se
pensaba en ese momento*.

Formato de cada entrada:

```
## AAAA-MM-DD — Título corto
**Hecho:** qué se construyó o cambió.
**Decidido:** qué se decidió y por qué (los ADRs llevan el detalle).
**Abierto:** qué quedó sin resolver.
```

---

## 2026-09-28 — Corpus v1: 60 tarjetas

**Hecho:** el corpus llegó a las 60 tarjetas del objetivo, en 10 categorías
(19 básicas, 31 intermedias, 10 avanzadas; 45 con ejemplo ejecutable).

**Decidido:** la página `glossary` de los docs resultó ser la mejor fuente para curar en
volumen: 51 términos con definiciones concisas y exactas, cada una enlazando a la página
que lo desarrolla. Las tarjetas se escribieron contra esas definiciones y contra las
páginas citadas, no de memoria.

**Un ejemplo inventado, detectado y corregido:** la tarjeta de `PostToolUse` usaba
`npx prettier --write $FILE`. Esa variable **no existe**: los hooks reciben JSON por
stdin, y la forma real es `jq -r '.tool_input.file_path' | xargs npx prettier --write`.
Es justo lo que `CONTENT-GUIDE.md` prohíbe —un ejemplo inventado enseña algo falso— y se
coló igual. Conviene revisar los ejemplos contra la documentación, no contra el recuerdo.

**Verificado:** las 60 fuentes citadas existen en el sitemap; el `summary` más largo usa
94 de los 120 caracteres permitidos.

**Abierto:** quedan ~150 páginas de docs sin cubrir, la mayoría de nicho (despliegues
empresariales, gateways, SDK). El siguiente lote natural es el Agent SDK.

---

## 2026-09-28 — Fases 2 y 3: pipeline de contenido y cliente de iPhone

**Hecho:** `fetch-docs.mjs`, `extract-local.mjs` y `draft-cards.mjs`; el script de
Scriptable `ios/TagsCC.scriptable.js` y su guía de instalación.

**El caché por ETag del plan no era posible.** El servidor de docs no envía `ETag` y su
`Last-Modified` es la hora de cada petición, porque las páginas se generan al vuelo. Se
verificó descargando la misma página dos veces: el contenido es idéntico pero las
cabeceras no permiten revalidar. El caché quedó local, por antigüedad (`--max-age`, 24 h
por defecto) más un SHA-256 del contenido para distinguir lo que cambió de verdad.
Medido: 209 páginas en ~10 s en frío, ~1 s desde caché.

**Decidido:**
- `draft-cards.mjs` prioriza lo que Diego **no** usa todavía. El inventario local mostró
  cero hooks configurados, cero subagentes, cero comandos propios y ningún
  `~/.claude/CLAUDE.md`: justo las áreas donde una tarjeta rinde más.
- El validador ahora **importa las funciones del propio script de iOS** y compara su
  `pick()` contra la referencia en las seis ventanas de un día. Era el punto débil del
  ADR 0003: un contrato duplicado cuya divergencia no falla sola. Se comprobó que
  cambiar un dígito de la constante FNV hace fallar el validador.
- `extract-local.mjs` registra solo nombres y claves, nunca valores de configuración,
  porque el repo es público. Se revisó la salida para confirmarlo.

**Verificado:** Swift, el `pipeline/lib.mjs` de referencia y el script de iOS producen
los mismos índices (2, 2, 1, 4, 3, 6, 5) en las siete horas de prueba de un día.

**Abierto:**
- El repo aún no se publica en GitHub, así que `RAW_URL` del script de iOS sigue con el
  marcador `USUARIO/REPO`. Publicar es una acción hacia afuera y queda a decisión de Diego.
- El widget en el iPhone no está probado en un dispositivo real; requiere los pasos
  manuales de `ios/INSTALACION-IPHONE.md`.
- Hay una página `glossary` en los docs con definiciones de los conceptos centrales:
  buena fuente para curar en volumen.

---

## 2026-09-28 — Fase 1: agente de macOS

**Hecho:** `macos/` completo: `Selector`, `Corpus`, `Store`, `Scheduler`, `CardPanel`,
`MenuBarController` y `main.swift`, más `build.sh`, `install.sh` y `uninstall.sh`.
Compila con `swiftc` contra el SDK de Command Line Tools, sin Xcode, y produce un
`TagsCC.app` firmado ad-hoc.

**Verificado ejecutando, no asumido:**
- La app arranca, carga el corpus, elige una tarjeta y registra el estado.
- **Swift y JavaScript dan el mismo índice en las seis ventanas horarias de un día.**
  Es la prueba que valida todo el diseño sin servidor (ADR 0003): se corrió el selector
  de Swift en un arnés aparte y se comparó con la implementación JS de `pipeline/lib.mjs`.
- La tarjeta se ve correctamente en modo oscuro y el ejemplo se puede seleccionar.

**Decidido:**
- El código del nivel superior obligó a nombrar el punto de entrada `main.swift`; Swift no
  lo permite en otros archivos.
- El menú de la barra ofrece "Explorar" por categoría en lugar de un campo de búsqueda:
  para un corpus de 12–150 tarjetas es más útil y no necesita una ventana propia.
- `build.sh` escribe la ruta del repo en el `Info.plist` (`TCCCorpusPath`), así editar una
  tarjeta y correr `build.mjs` se ve sin recompilar la app.

**Dos defectos encontrados al mirar la pantalla, no el código:**
1. El bloque `example` se truncaba a una línea: le faltaba `fixedSize` vertical.
2. El `body` conservaba los saltos de línea del YAML y quebraba frases a la mitad. Se
   resolvió normalizando en `build.mjs` con semántica de markdown (salto simple = espacio,
   línea en blanco = párrafo), no en los clientes: si cada cliente reflowara por su
   cuenta, Mac e iPhone podrían partir el texto distinto. `example` se deja intacto.

**Abierto:** la notificación de desbloqueo `com.apple.screenIsUnlocked` no se pudo probar
de forma automatizada; requiere bloquear la pantalla a mano. El timer de intervalo, que es
el disparador garantizado, sí quedó verificado.

---

## 2026-09-28 — Fase 0: repo y documentación técnica

**Hecho:** Se creó el repo con `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/SDD.md`, esta
bitácora, `docs/CONTENT-GUIDE.md` y los ADRs 0001–0004. Se definió el schema de la
tarjeta, `content/taxonomy.yaml`, ocho tarjetas semilla escritas a mano, y
`pipeline/build.mjs` + `pipeline/validate.mjs` con parser de YAML propio.

**Decidido:**
- Widget de iPhone vía **Scriptable** (ADR 0001). El usuario pidió explícitamente evitar
  cualquier costo y no publicar nada en el App Store; se le aclaró que instalar Scriptable
  no implica ninguna de las dos cosas.
- **Git como único backend** (ADR 0002), con `dist/` commiteado.
- **Selección determinista con FNV-1a** en lugar de sincronización (ADR 0003).
- **`swiftc` sin Xcode** para la app de Mac (ADR 0004).
- `summary` con límite duro de 120 caracteres, validado en el build, porque es el ancho
  real del widget `accessoryRect`. Se trata como restricción de arquitectura: si un
  concepto no cabe, se parte en dos tarjetas.
- El debounce de 90 minutos se considera parte del producto, no una optimización: sin él,
  el disparador por desbloqueo generaría decenas de pop-ups al día y el sistema se
  volvería algo que se desinstala.

**Verificado en el entorno** (no asumido):
- El SDK de Command Line Tools incluye `SwiftUI.framework`, `AppKit.framework` y
  `UserNotifications.framework` → la app nativa de Mac es viable sin Xcode.
- Los docs se movieron de `docs.anthropic.com` a `code.claude.com/docs/en/<slug>`, sirven
  markdown al pedir `.md` (HTTP 200), y el sitemap lista 209 páginas.

**Corregido durante la sesión:** el vector de prueba de `fnv1a32("tags-cc")` estaba
escrito de memoria y era incorrecto. Se calculó el valor real (`0x4022b04d`) y se
añadieron los dos vectores canónicos de la especificación FNV-1a para que el test
verifique que el algoritmo es el correcto, no solo que las implementaciones coinciden.

**Abierto:**
- El nombre del repo de GitHub y si se publica como público (el plan lo asume público;
  el corpus no es sensible).
- Cuántas tarjetas tendrá v1 (estimado ~60) y en qué orden se curan las categorías.
- Si el progreso de aprendizaje llegará algún día al iPhone; hoy requiere el backend que
  se descartó.
