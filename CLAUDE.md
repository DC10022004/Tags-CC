# Tags CC

Sistema de microaprendizaje que muestra un concepto de Claude Code o de programación
general (un "tag") en una tarjeta al desbloquear la Mac y cada pocas horas, y el mismo
concepto como widget en la pantalla de bloqueo del iPhone. El corpus de programación
general se sumó en el ADR 0005.

El objetivo no es documentar Claude Code. Es **provocar recuerdo espaciado**: que Diego
tropiece con un concepto que no domina, en un momento en que puede aplicarlo.
Cada decisión de diseño se juzga contra eso.

## Invariantes

Reglas que no se rompen sin un ADR nuevo en `docs/adr/`:

1. **El corpus está en español.** Los términos técnicos se conservan en inglés
   (`hook`, `subagent`, `skill`), la explicación es en español.
2. **`summary` ≤ 120 caracteres.** Es el ancho útil del widget `accessoryRect` de iOS.
   No es una preferencia de estilo: si se excede, el build falla.
3. **Cero dependencias externas.** El pipeline corre con Node 22 puro (sin `npm install`,
   sin `package.json` de producción). La app de Mac usa solo el SDK del sistema.
4. **Nada requiere Xcode.** La máquina solo tiene Command Line Tools. Todo se compila con
   `swiftc`. En iOS se usa Scriptable, no un target de WidgetKit.
5. **Sin backend.** El único contrato entre componentes es `dist/tags.json`.
6. **El pipeline no publica solo.** `pipeline/` genera borradores; el texto que llega a
   `content/tags/` lo redacta y cura una persona (o Claude bajo revisión).

## Estructura

| Carpeta | Qué contiene |
|---|---|
| `content/tags/*.yaml` | Fuente de verdad del corpus: una tarjeta por archivo |
| `content/taxonomy.yaml` | Categorías y niveles válidos |
| `pipeline/` | Node 22: descarga docs, genera borradores, compila y valida |
| `dist/` | Generado **y commiteado** — el iPhone lo lee por GitHub raw |
| `macos/` | Agente de barra de menú + tarjeta (Swift) y su LaunchAgent |
| `ios/` | Script de Scriptable para el widget |
| `state/` | Progreso local, gitignored |
| `docs/` | Arquitectura, SDD, bitácora, guía editorial y ADRs |

## Comandos

```bash
node pipeline/validate.mjs        # valida content/ contra el schema (no escribe nada)
node pipeline/build.mjs           # content/ -> dist/tags.json + dist/manifest.json
node pipeline/fetch-docs.mjs      # cachea los .md de code.claude.com en .cache/docs/
node pipeline/draft-cards.mjs     # borradores a content/drafts/ para curar
./macos/build.sh                  # compila macos/build/TagsCC.app
./macos/install.sh                # instala el LaunchAgent y lo arranca
./macos/uninstall.sh              # lo detiene y lo desinstala
```

`dist/` **se commitea**: el iPhone no puede ejecutar el build, lee el resultado.
Después de tocar cualquier YAML en `content/`, corre `build.mjs` y commitea ambos.

## Convenciones

- **`id` de una tarjeta**: `<categoria>-<concepto>` en kebab-case (`hooks-pretooluse`).
  Es permanente: `related` y el estado de aprendizaje apuntan a él. Renombrar un `id`
  rompe el progreso, así que se trata como un cambio de contrato.
- **`source` es obligatorio** y apunta a la página de docs de la que salió la tarjeta,
  para poder re-auditarla cuando la documentación cambie.
- Toda decisión no obvia se registra en `docs/BITACORA.md`. Las que cambian la
  estructura del sistema llevan además un ADR en `docs/adr/`.
- Los docs oficiales sirven markdown: pide `<url>.md`, no parsees HTML.

## Fuera de alcance (deliberadamente)

Backend, cuentas de usuario, sincronización del progreso entre dispositivos, y app
nativa de iOS. Cada una está descartada por un ADR, no por olvido — lee
`docs/adr/` antes de proponerlas.
