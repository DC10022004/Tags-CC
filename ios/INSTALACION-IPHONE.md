# Instalar el widget en el iPhone

Unos diez minutos, una sola vez. No pagas nada, no publicas nada en el App Store y no
necesitas Xcode ni cuenta de desarrollador: instalas **Scriptable**, que es una app
gratuita como cualquier otra, y le pegas un script tuyo (ver `docs/adr/0001`).

## Antes de empezar: publicar el corpus

El iPhone no puede correr el build, así que lee el JSON ya generado desde internet.

```bash
node pipeline/build.mjs
git add -A && git commit -m "corpus"
gh repo create tags-cc --public --source=. --push
```

Tu URL raw queda así — cópiala, la necesitas en el paso 3:

```
https://raw.githubusercontent.com/<tu-usuario>/tags-cc/main/dist/tags.json
```

Compruébala antes de seguir; si esto no devuelve JSON, el widget tampoco lo verá:

```bash
curl -s https://raw.githubusercontent.com/<tu-usuario>/tags-cc/main/dist/tags.json | head -5
```

> El repo tiene que ser **público**. Uno privado obligaría a guardar un token de GitHub
> dentro del script, que es un archivo sin cifrar en el teléfono. El corpus son
> explicaciones de documentación pública, así que no hay nada que proteger.

## 1. Instalar Scriptable

App Store → busca **Scriptable** (de Simon B. Støvring) → obtener. Es gratis.

## 2. Crear el script

1. Abre Scriptable y toca **+** arriba a la derecha.
2. Borra lo que haya y pega el contenido completo de `ios/TagsCC.scriptable.js`.
   La forma más cómoda: abre este repo en GitHub desde Safari en el iPhone, entra al
   archivo, toca **Raw**, selecciona todo y copia.
3. Toca el icono de ajustes del script (abajo) y ponle de nombre **Tags CC**.

## 3. Apuntarlo a tu corpus

Cerca del inicio del script, cambia esta línea por tu URL raw:

```js
const RAW_URL = "https://raw.githubusercontent.com/USUARIO/REPO/main/dist/tags.json";
```

Si dejas `USUARIO/REPO` sin cambiar, el script te avisará con una alerta al ejecutarlo.

## 4. Probarlo

Toca **▶︎** dentro de Scriptable. Debe abrirse una tabla con el concepto del momento:
resumen, explicación, ejemplo y un enlace a la documentación.

Si sale "Sin corpus", la URL está mal o no hay red. Ábrela en Safari: debe mostrar JSON.

## 5. El widget en la pantalla de bloqueo

1. Bloquea el iPhone y toca la pantalla de bloqueo hasta que aparezca **Personalizar**.
2. Elige **Pantalla de bloqueo** y toca la zona de widgets debajo de la hora.
3. Busca **Scriptable** y elige el widget **rectangular** (el ancho): es el único donde
   caben el término y su resumen.
4. Toca el widget recién puesto → **Script: Tags CC**. Deja *When Interacting* en
   **Run Script**, así al tocarlo se abre la tarjeta completa.
5. Listo → Salir.

## 6. Opcional: en la pantalla de inicio

Mantén pulsada la pantalla de inicio → **+** → Scriptable → tamaño mediano → elige
**Tags CC**. Ahí sí caben el resumen y el "para qué sirve".

## Qué esperar

- **iOS decide cuándo refresca el widget**, no el script. Puede tardar; es normal y no
  se puede forzar. Por eso el concepto se elige por ventana horaria: aunque el refresco
  llegue tarde, muestra el que corresponde a ese momento.
- **Funciona sin señal**: guarda una copia del corpus y la usa cuando no hay red. La
  primera vez sí necesita conexión.
- **El iPhone muestra el mismo concepto que la Mac** en la misma ventana de horas, sin
  sincronizarse: ambos lo calculan (`docs/SDD.md` §2).
- **Lo que marcas como sabido en la Mac no llega al iPhone.** El progreso es local a la
  Mac; en el teléfono el widget solo exhibe (`docs/adr/0002`).

## Cuando actualices el corpus

```bash
node pipeline/build.mjs && git add -A && git commit -m "corpus" && git push
```

El widget lo toma en su siguiente refresco. No hay que tocar nada en el iPhone.
