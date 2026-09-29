# AGENTS.md

Las instrucciones de este proyecto viven en **`CLAUDE.md`**. Léelo completo antes de
trabajar: invariantes, estructura, comandos y convenciones aplican igual a cualquier
agente. Donde diga "Claude", entiende "el agente que está trabajando".

Este archivo no duplica ese contenido a propósito: una copia se desincroniza en cuanto
`CLAUDE.md` cambia.

## Notas para auditorías y ajustes

- Antes de proponer cambios de estructura, lee `docs/adr/`. Lo descartado ahí (backend,
  cuentas, sincronización, app nativa de iOS) está descartado por decisión, no por olvido.
- Al auditar tarjetas, usa `docs/CONTENT-GUIDE.md` como criterio. El corpus cubre Claude
  Code y programación general (ADR 0005).
- Termina siempre con `node pipeline/validate.mjs` en verde. Si tocaste `content/`, corre
  también `node pipeline/build.mjs`: `dist/` se commitea junto con el contenido.
- Registra en `docs/BITACORA.md` toda decisión que no sea obvia.
