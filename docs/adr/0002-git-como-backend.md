# ADR 0002 — Git es el único backend

Fecha: 2026-09-28 · Estado: aceptado

## Contexto

El corpus tiene que llegar a dos clientes: una app en la Mac (acceso al sistema de archivos)
y un script en el iPhone (solo HTTPS). Opciones consideradas: un repo Git con `dist/`
servido por GitHub raw; Supabase (ya hay un MCP conectado); iCloud Drive; o un servidor
propio.

## Decisión

Un repo Git. El corpus compilado se **commitea** en `dist/` y el iPhone lo lee por la URL
raw de GitHub. No hay backend, no hay base de datos, no hay autenticación.

Se asume repo **público**: un repo privado obliga a poner un token de GitHub dentro del
script de Scriptable, que es un archivo en el teléfono sin cifrar. El contenido son
explicaciones de documentación pública, así que la privacidad no aporta nada y el token
sí resta.

## Consecuencias

**A favor**
- Cero costo y cero operación. Nada que monitorear, nada que se caiga, nada que expire.
- Versionado e historial del contenido gratis; cada cambio de tarjeta es un diff revisable.
- El cliente de Mac no necesita red: lee el archivo local del repo.

**En contra**
- **El progreso de aprendizaje no cruza de dispositivo.** GitHub raw es solo lectura, así
  que el iPhone no puede reportar qué se vio. En v1 el estado vive en la Mac y el iPhone es
  un cliente de exhibición. Es el costo real de esta decisión y se acepta a sabiendas: el
  usuario pidió aprendizaje por exposición, y la exposición no necesita escritura.
- `dist/` commiteado significa artefactos generados en el repo, lo que normalmente se evita.
  Aquí es obligatorio: el iPhone no puede ejecutar el build. Se mitiga haciendo el build
  determinista (hash que excluye `generated_at`), de modo que un build sin cambios de
  contenido produzca un diff vacío.
- La URL raw de GitHub tiene caché de algunos minutos. Irrelevante para contenido que rota
  cada cuatro horas.

## Reversión

Si algún día se quiere progreso compartido, Supabase entraría **solo para el estado**,
dejando el contenido en Git. El contrato `dist/tags.json` no cambiaría.
