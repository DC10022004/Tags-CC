# ADR 0004 — La app de Mac se compila con `swiftc`, sin Xcode

Fecha: 2026-09-28 · Estado: aceptado

## Contexto

La máquina tiene Command Line Tools (`/Library/Developer/CommandLineTools`), no Xcode.
Instalar Xcode son ~10 GB y una descarga larga para un proyecto de una sola ventana.

Se verificó qué hay realmente en el SDK de CLT antes de decidir:

```
$ ls $(xcrun --show-sdk-path)/System/Library/Frameworks | grep -E "SwiftUI|AppKit|UserNotifications"
AppKit.framework
SwiftUI.framework
UserNotifications.framework
```

Las alternativas eran: Electron (cientos de MB para una tarjeta de texto), un pop-up con
`osascript display dialog` (roba el foco, se ve como un error del sistema, no se puede
maquetar), o compilar nativo a mano.

## Decisión

Compilar con `swiftc` contra el SDK de CLT y armar el bundle `.app` a mano en `build.sh`
(`Info.plist` con `LSUIElement=true` + `codesign -s -` ad-hoc).

El mecanismo de presentación es un **`NSPanel` flotante y no-activante**, no una
notificación del sistema. Esa es la parte importante de la decisión: una ventana propia no
requiere ningún permiso ni una firma real de Apple, mientras
`UNUserNotificationCenter` con firma ad-hoc puede simplemente no entregar nada. Las
notificaciones quedan como capa opcional degradable.

## Consecuencias

**A favor**
- Sin Xcode, sin descargas, sin dependencias. La app son unos pocos archivos `.swift`.
- Nativa de verdad: rápida, respeta modo claro/oscuro, no roba el foco del teclado.
- Compilación en segundos, lo que hace el ciclo de iteración corto.

**En contra**
- `build.sh` hace a mano lo que Xcode haría solo (plist, estructura del bundle, firma). Es
  frágil ante cambios de SDK, y está aislado en un único script por eso.
- Firma ad-hoc: la app sirve para uso local y no se puede distribuir. Aceptable, es para
  una sola máquina.
- Sin `xcodebuild` no hay pruebas de UI automatizadas; la verificación de la ventana es
  manual y está listada como tal en el SDD §8.
- Al no depender de notificaciones, la tarjeta solo se ve si hay una sesión gráfica activa
  — que es exactamente el momento en que tiene sentido mostrarla.

## Reversión

Si el proyecto crece (menú de preferencias, varias ventanas), migrar a un proyecto de Xcode
es directo: los `.swift` se reusan tal cual y solo cambia el sistema de build.
