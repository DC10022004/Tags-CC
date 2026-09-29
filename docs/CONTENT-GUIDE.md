# Guía editorial de tarjetas

Una tarjeta buena se lee en diez segundos, en una pantalla que apareció sin que la
pidieras, y te deja algo que puedes usar hoy. Todo lo de abajo sirve a eso.

## Tono

- **Español, segunda persona.** "Puedes bloquear una herramienta antes de que corra", no
  "es posible bloquear herramientas".
- **Los términos técnicos se quedan en inglés**: `hook`, `skill`, `subagent`, `plan mode`.
  Traducirlos rompe el propósito: Diego necesita reconocer la palabra cuando la vea en
  los docs o en la terminal.
- **Sin relleno.** Nada de "es importante notar que" ni "en el mundo del desarrollo
  moderno". Si una frase se puede borrar sin perder información, se borra.
- **Sin promesas.** "Acelera tu flujo de trabajo" no enseña nada. Di qué hace.

## Los campos

**`term`** — La palabra tal como se dice en voz alta. `PreToolUse hook`, no
`El hook de tipo PreToolUse`.

**`summary`** — Máximo 120 caracteres, una frase, y es lo **único** que se ve en la
pantalla de bloqueo. Escríbelo como si fuera lo único que se va a leer, porque
frecuentemente lo será. Empieza por el verbo o por lo que la cosa *es*.

Si no cabe en 120 caracteres, el problema casi nunca es la redacción: es que la tarjeta
abarca dos conceptos. Pártela.

**`body`** — Tres a seis líneas. Puedes cortar las líneas donde te resulte cómodo
escribir: el build las reflowa con semántica de markdown, así que un salto simple se une
con espacio y una línea en blanco separa párrafos. Si quieres un corte de verdad, deja
una línea en blanco.

En `example` es al revés: los saltos de línea se respetan tal cual, porque ahí son parte
del comando.

Tres a seis líneas. Qué es, cómo funciona, y el límite o la trampa que
importa. La trampa es lo que hace útil la tarjeta: "los hooks corren con tu shell y sin
confirmación" vale más que otra frase describiendo la sintaxis.

**`example`** — Real y ejecutable. Un comando que se pueda pegar en la terminal o un
fragmento de `settings.json` que se pueda pegar en el archivo. Nunca pseudocódigo, nunca
`tu-comando-aqui`. Si no tienes un ejemplo real, deja el campo vacío: un ejemplo inventado
enseña algo falso.

**`why`** — Para qué le sirve a Diego, concreto. "Para que Claude no corra `rm -rf` sin que
lo apruebes" es útil; "para mejorar la seguridad" no.

**`level`**
- `basico` — lo usas en tu primera semana (`/clear`, `CLAUDE.md`, plan mode).
- `intermedio` — lo configuras cuando quieres más control (hooks, permisos, subagentes).
- `avanzado` — SDK, plugins, MCP propio, `settings.json` a fondo.

**`source`** — Obligatorio. Es lo que permite re-auditar la tarjeta cuando los docs
cambien, y ya cambiaron una vez (`docs.anthropic.com` → `code.claude.com`).

## Alcance de una tarjeta

Un concepto, una tarjeta. `hooks` como tema no es una tarjeta: `PreToolUse hook`,
`PostToolUse hook` y `dónde se configuran los hooks` son tres, ligadas por `related`.

La señal de que una tarjeta es demasiado grande es que su `summary` no cabe. La señal de
que es demasiado pequeña es que su `body` repite el `summary` con otras palabras.

## Checklist antes de publicar

- [ ] `summary` ≤ 120 chars y se entiende **solo**, sin el resto de la tarjeta
- [ ] El `example` se puede pegar y corre de verdad
- [ ] `body` dice el límite o la trampa, no solo la definición
- [ ] `why` es concreto, no promocional
- [ ] `source` abre y respalda lo que dice la tarjeta
- [ ] Los `id` en `related` existen
- [ ] `node pipeline/validate.mjs` pasa
