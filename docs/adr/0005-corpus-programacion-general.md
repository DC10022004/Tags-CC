# ADR 0005 — El corpus incluye programación general, no solo Claude Code

Fecha: 2026-09-29 · Estado: aceptado

## Contexto

El corpus v1 cubría solo Claude Code (60 tarjetas, 10 categorías). Diego pidió sumar dos
fuentes de conceptos de programación y desarrollo en general:

- El glosario "Los 200 términos más utilizados en programación" de MoureDev
  (mouredev.pro/recursos), en PDF.
- Su diccionario técnico personal en Notion, escrito mientras trabaja en otro proyecto:
  Git, secretos y `.env`, piezas de una app web, npm, despliegue.

El objetivo del sistema no cambia —provocar recuerdo espaciado de lo que Diego no domina—,
pero su dominio sí: Claude Code deja de ser el único tema.

## Decisión

1. **Doce categorías nuevas** en `content/taxonomy.yaml` (`fundamentos`, `algoritmos`,
   `paradigmas`, `web`, `datos`, `ia`, `git`, `arquitectura`, `infra`, `seguridad`,
   `herramientas`, `proceso`). El prefijo del `id` sigue siendo la categoría.
2. **Texto propio, no transcrito.** Las fuentes deciden *qué* conceptos entran; cada
   tarjeta se redacta con la guía editorial (resumen de 120, la trampa, un ejemplo que
   corre). Las definiciones del PDF son de una línea y no dicen la trampa, que es lo que
   hace útil una tarjeta. Tampoco se copia texto ajeno a un repo público.
3. **`source` apunta a documentación pública y auditable** (MDN, git-scm, docs de Node,
   Supabase, Vercel, Wikipedia), no al PDF ni a Notion. El PDF no tiene URLs por término y
   la página de Notion es privada.
4. **Nada específico de otros proyectos entra al corpus.** El diccionario de Notion
   menciona nombres de repos, usuarios de GitHub y proyectos de Supabase. El repo es
   público (ADR 0002), así que esas tarjetas se generalizan.
5. **Términos duplicados se fusionan** en una tarjeta cuando son el mismo concepto o
   solo se entienden por contraste: *Build*/*Compilación*, *Cola*/*FIFO*, *Pila*/*LIFO*,
   *REST*/*API RESTful*, *Big O*/*Análisis de complejidad*/*Eficiencia*,
   *Parámetro*/*Argumento*, *Objeto*/*Instancia*/*Instanciación*, entre otros.

No cambia ningún contrato: el schema de la tarjeta, `dist/tags.json`, el selector y los
clientes quedan igual. Los clientes muestran `category` tal cual, sin lista cerrada.

## Consecuencias

**A favor**
- El sistema cubre el vocabulario que Diego encuentra al trabajar con Claude, no solo el
  de la herramienta. Muchas tarjetas nuevas enlazan por `related` a las de Claude Code
  (`git-rama` → `workflow-worktrees`, `herramientas-variable-entorno` →
  `configuracion-env-vars`), así que los dos corpus se refuerzan.

**En contra**
- **Dilución.** La selección es uniforme sobre todo el corpus (ADR 0003). Con ~267
  tarjetas, una de Claude Code sale ~23 % de las veces, contra 100 % antes. Es el costo
  principal y se acepta a sabiendas: el pedido fue ampliar el corpus. Si resulta
  excesivo, la palanca menos invasiva es un filtro de categorías en la Mac (estado local,
  no toca el contrato); ponderar el selector obligaría a cambiarlo en Swift y en JS a la
  vez, con nuevos vectores de conformidad.
- Cada tarjeta de las fuentes nuevas pasa por la misma curaduría que las de Claude Code;
  la invariante 6 no se relaja.
- El menú "Explorar" de la Mac pasa de 10 a 22 submenús.
