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
