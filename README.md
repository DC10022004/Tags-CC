# Tags CC

Microaprendizaje de Claude Code por exposición: una tarjeta con un concepto aparece al
desbloquear la Mac y cada pocas horas, y el mismo concepto se ve como widget en la
pantalla de bloqueo del iPhone.

No es documentación para consultar. Es documentación que te encuentra.

## Cómo está armado

```
content/tags/*.yaml  ──►  pipeline/build.mjs  ──►  dist/tags.json  ──┬──►  Mac: TagsCC.app
                                                                     └──►  iPhone: Scriptable
```

Tres componentes que no se conocen entre sí, unidos por un solo archivo JSON. Sin
backend, sin costo, sin Xcode. Mac e iPhone muestran el mismo concepto porque ambos lo
**calculan** con la misma función determinista, no porque se sincronicen.

## Empezar

```bash
node pipeline/validate.mjs     # valida el contenido
node pipeline/build.mjs        # genera dist/tags.json
```

Para la Mac: `./macos/build.sh && ./macos/install.sh`
Para el iPhone: ver [ios/INSTALACION-IPHONE.md](ios/INSTALACION-IPHONE.md)

## Documentación

| Documento | Para qué |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Objetivo, invariantes y convenciones del proyecto |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Componentes, flujos y límites del sistema |
| [docs/SDD.md](docs/SDD.md) | Diseño detallado: schema, algoritmos, estados, fallos |
| [docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md) | Cómo se escribe una tarjeta |
| [docs/BITACORA.md](docs/BITACORA.md) | Qué se hizo y qué se decidió, en orden |
| [docs/adr/](docs/adr/) | Decisiones estructurales y lo que costó cada una |

## Estado

Fases 0–3 completas: documentación, pipeline de contenido, agente de macOS y widget de iPhone.
Pendiente: publicar el repo para que el iPhone lea el corpus, y curar el corpus hacia ~60 tarjetas.
