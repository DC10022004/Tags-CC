# Arquitectura

## Restricciones que la determinan

La arquitectura no es una elección estética: la fuerzan cuatro hechos del entorno,
verificados el 2026-09-28.

| Hecho | Consecuencia |
|---|---|
| La Mac tiene Command Line Tools, no Xcode | Nada de `xcodebuild`; se compila con `swiftc` |
| El SDK de CLT **sí** incluye `SwiftUI`, `AppKit` y `UserNotifications` | La tarjeta de Mac puede ser nativa |
| iOS sin Xcode y sin pagar | El widget de lock screen se hace con Scriptable |
| `code.claude.com/docs/en/<slug>.md` devuelve markdown puro (209 páginas en el sitemap) | El pipeline no parsea HTML |

## Vista de componentes

```
      ┌─ pipeline/fetch-docs.mjs ──── code.claude.com/docs (209 .md)
      │
      ├─ pipeline/extract-local.mjs ─ ~/.claude (skills, agents, hooks, settings)
      │        │
      │        ▼
      │  content/drafts/  ──(curaduría humana)──►  content/tags/*.yaml
      │                                                   │
      │                                                   ▼
      └──────────────────────────────────► pipeline/build.mjs
                                                          │
                                              ┌───────────┴───────────┐
                                              ▼                       ▼
                                      dist/tags.json          dist/manifest.json
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        ▼ (lectura de archivo)                      ▼ (HTTPS, GitHub raw)
             macOS: TagsCC.app                             iOS: Scriptable
             · LaunchAgent residente                       · widget accessoryRect
             · tarjeta NSPanel + SwiftUI                   · caché local offline
             · icono de barra de menú                      · vista completa al abrir
             · state/progress.json (Leitner)
```

Los tres componentes —pipeline, cliente Mac, cliente iOS— no se conocen entre sí.
El único acoplamiento es el contrato `dist/tags.json`, descrito en el SDD.

## Por qué no hay servidor

El requisito "que Mac e iPhone muestren lo mismo" parece pedir sincronización. No la
pide: se resuelve con una **función de selección determinista** compartida.

Ambos clientes calculan `pick(corpus, ahora)` con el mismo algoritmo (especificado una
vez en el SDD, implementado dos veces: Swift y JS). Dadas la misma versión del corpus y
la misma ventana horaria, ambos llegan al mismo `id` sin intercambiar un solo byte.

Lo que se gana: cero infraestructura, cero costo, funciona sin red, y el historial de
Git da versionado del contenido gratis.

Lo que se pierde: el progreso de aprendizaje (qué ya dominas) **no** cruza de
dispositivo. En v1 vive solo en la Mac y solo reordena la baraja local. El iPhone es
un cliente de exhibición, no de interacción. Es un compromiso aceptado, no un descuido
— ver `adr/0002-git-como-backend.md`.

## Flujos

**Alta de contenido.** `fetch-docs` cachea los docs → `draft-cards` propone borradores
con sus extractos y `source` → una persona los redacta y mueve a `content/tags/` →
`build` valida y compila → commit de `content/` + `dist/` → el iPhone ve el cambio en
su siguiente refresco de widget.

**Exhibición en Mac.** El LaunchAgent mantiene `TagsCC.app` residente. Tres disparadores
(desbloqueo de pantalla, despertar del sueño, timer de intervalo) piden mostrar tarjeta.
Un debounce descarta la petición si ya se mostró una hace poco. La tarjeta aparece como
panel flotante; la respuesta del usuario (*lo sé* / *repetir pronto*) se escribe en
`state/progress.json`.

**Exhibición en iPhone.** iOS refresca el widget cuando quiere (no es controlable). El
script intenta descargar el corpus; si falla, usa su caché; calcula `pick()` y dibuja.
Nunca muestra un estado vacío mientras exista caché.

## Límites explícitos

- **No hay backend.** `adr/0002`.
- **No hay app nativa de iOS.** `adr/0001`.
- **No hay sync de progreso.** Consecuencia de `adr/0002`.
- **No se controla cuándo iOS refresca el widget.** El sistema decide; el diseño lo
  absorbe usando ventanas horarias en lugar de eventos.
- **Las notificaciones del sistema son opcionales.** El mecanismo principal en Mac es
  una ventana, que no requiere permisos ni firma de Apple. Ver `adr/0004`.
