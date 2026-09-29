# ADR 0001 — El widget de iPhone se hace con Scriptable

Fecha: 2026-09-28 · Estado: aceptado

## Contexto

Requisito: un widget en la **pantalla de bloqueo** del iPhone que muestre el tag actual.
Restricción del usuario, textual: sin costo y sin publicar nada en el App Store.

En iOS, un widget de pantalla de bloqueo solo lo puede proveer una app instalada. Las
opciones reales:

1. **App nativa propia con WidgetKit.** Requiere Xcode (~10 GB, no instalado) y firma. Con
   Apple ID gratuito la app caduca cada 7 días y hay que reinstalarla; sin caducidad son
   99 USD/año. No exige publicar en el App Store, pero sí una de las dos molestias.
2. **Scriptable.** App gratuita ya publicada en el App Store que ejecuta JavaScript del
   usuario y expone widgets, incluidos `accessoryRect`/`accessoryInline` de la pantalla de
   bloqueo. Instalarla es instalar una app; el usuario no publica ni paga nada.
3. **Calendario suscrito (.ics).** Un feed con "eventos" cuyo título es el concepto, leído
   por el widget nativo de Calendario. No instala nada, pero el widget es de Calendario y
   el texto visible es muy corto.
4. **Atajos / PWA.** No pueden proveer un widget de pantalla de bloqueo con texto dinámico
   propio. Descartadas por no cumplir el requisito.

## Decisión

Scriptable (opción 2). Es la única que da un widget de pantalla de bloqueo con texto
dinámico real sin Xcode, sin costo y sin caducidad.

Se aclaró al usuario que su objeción —costo y publicación— no aplica a esta opción: instalar
Scriptable es como instalar cualquier app gratuita, y el script es un archivo local suyo.

## Consecuencias

**A favor**
- Cero costo, cero caducidad, cero Xcode. Implementable en horas.
- Un solo archivo JS, versionado en el repo, editable desde el iPhone.
- Funciona offline con caché propia.

**En contra**
- Depende de una app de terceros: si Scriptable se abandona, este componente muere. El
  riesgo está acotado porque el corpus (`dist/tags.json`) es independiente del cliente:
  reemplazarlo no toca el contenido ni la Mac.
- **No hay notificaciones push programadas.** Scriptable solo agenda notificaciones locales
  cuando el script corre. En el iPhone el producto es un widget pasivo, no un aviso que
  interrumpe; la interrupción vive en la Mac, que es donde el usuario la pidió.
- iOS decide cuándo refrescar el widget; no se puede forzar. Absorbido en el diseño usando
  ventanas horarias en lugar de eventos (ver ADR 0003).
- El script no se puede instalar por línea de comandos: hay un paso manual en el iPhone,
  documentado en `ios/INSTALACION-IPHONE.md`.

## Reversión

La opción 1 sigue disponible si algún día se instala Xcode. Consumiría el mismo
`dist/tags.json` y reusaría el algoritmo de selección del ADR 0003: sería un cliente nuevo,
no un rediseño.
