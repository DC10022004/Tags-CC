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
