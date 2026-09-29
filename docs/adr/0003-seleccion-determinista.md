# ADR 0003 — Selección determinista en vez de sincronización

Fecha: 2026-09-28 · Estado: aceptado

## Contexto

Requisito: Mac e iPhone deben mostrar el **mismo** concepto en un momento dado. La lectura
literal pide un estado compartido ("cuál es el tag actual"), y un estado compartido pide un
servidor, que el ADR 0002 descartó.

## Decisión

Ningún cliente consulta cuál es el tag actual: cada uno lo **calcula**. Ambos ejecutan la
misma función pura sobre entradas que ya comparten sin comunicarse:

```
slot   = floor(minutosDesdeMedianocheLocal / (intervalHours * 60))
clave  = "{version}|{AAAA-MM-DD}|{slot}"
índice = fnv1a32(clave) % count
```

La versión del corpus y su orden vienen de `dist/tags.json`; la fecha y la hora las tiene
cada dispositivo. Con las mismas entradas, el mismo resultado, sin intercambiar un byte.

**FNV-1a de 32 bits** se eligió por portabilidad, no por calidad: se escribe en seis líneas
idénticas en Swift y en JavaScript, sin dependencias y sin ambigüedad de aritmética. No
necesita ser criptográfico; necesita dispersar y ser reproducible.

## Consecuencias

**A favor**
- Cumple el requisito sin servidor, sin red y sin reloj compartido más allá de la hora del
  sistema.
- Verificable con tests: los vectores de conformidad del SDD §2.2 hacen que una divergencia
  entre implementaciones falle de forma visible.

**En contra**
- **El algoritmo es un contrato duplicado.** Vive dos veces, en Swift y en JS. Si una copia
  cambia y la otra no, los clientes divergen en silencio. Mitigación: los vectores de
  conformidad son normativos y se prueban en ambos lados; el SDD es la única fuente de la
  especificación.
- El orden de `tags` en el JSON pasa a ser parte del contrato: reordenar cambia qué se
  muestra. Por eso el build ordena por `id`, de forma estable.
- Cruzar un huso horario reordena la ventana en curso. Sin importancia para el propósito.
- El sesgo por progreso en la Mac (SDD §2.3) **rompe la coincidencia a propósito** cuando un
  tag ya está dominado. Está acotado a tres saltos para que los dispositivos no se separen
  demasiado: se prefirió aprender bien en la Mac a coincidir perfectamente con el iPhone.

## Alternativa descartada

Un contador de rotación en un archivo compartido por iCloud. Añade un punto de fallo y una
carrera de escritura para resolver algo que una función pura resuelve sin estado.
