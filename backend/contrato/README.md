# Contrato

Esta carpeta es la fuente de verdad del contrato de la API. `openapi.yaml` se
versiona acá, y el YAML que se entrega en el vault se **genera** desde este
archivo con `npm run contrato:exportar`.

Antes el YAML canónico vivía solo en el vault, fuera del repo, y esta carpeta
entera estaba en `.gitignore` con el comentario "herramienta local, nunca
versionada". Eso dejaba sin control de versiones justo lo que sirve para
detectar una desincronización: las 11 entradas de `PERMITIDAS`, la lógica de
comparación y el propio documento. Un puente que nadie ve revisar es un puente
que nadie revisa.

## Sentido único

```
contrato/openapi.yaml     ← canónico. Se edita acá, viaja en el PR.
        │
        │ npm run contrato:exportar
        ↓
TFI FitZone - OpenAPI.yaml (vault)   ← entregable, generado
```

El riesgo que queda es el contrario de una desincronización silenciosa: que uno
edite acá, se le pase exportar y entregue un vault viejo. `contrato:verificar`
existe para eso y `canonico.spec.ts` lo corre siempre.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run contrato:exportar` | Copia `openapi.yaml` al vault y anota el SHA en `vault-exportado.json`. |
| `npm run contrato:verificar` | Falla si el vault no coincide con el canónico, o si el manifiesto no corresponde (o sea: alguien editó el entregable en vez del repo). |
| `npm run test:contrato` | Corre `comparar.spec.ts`, `resolver.spec.ts` y `canonico.spec.ts`. **No necesita servidor.** |
| `npm run test:contrato:diff` | Compara el YAML contra el documento que publica el backend. **Necesita el server arriba.** |

Para el diff:

```
npm run build
node dist/main          # en otra terminal
npm run test:contrato:diff
```

## Por qué el diff va aparte

`*.diff.spec.ts` es el único spec que necesita el backend levantado, porque lee
por HTTP el documento OpenAPI que genera el `DocumentBuilder` de `main.ts`. Si
fuera parte de `npm run test:contrato`, ese comando solo pasaría si alguien se
acuerda de arrancar el server, y entonces no cumpliría su función.

Los otros tres specs no necesitan nada: cubren las 11 entradas de `PERMITIDAS`,
el resolver, y que el vault no haya quedado viejo.

## Configuración

`FITZONE_CONTRATO_URL` va en `.env.test` (gitignored a propósito) y es
obligatoria para el diff.

`FITZONE_CONTRACT_PATH` **no** se setea en `.env.test` a propósito: el spec usa
`contrato/openapi.yaml` por default. Si algún día hace falta comparar contra
otro archivo, se pasa por entorno; dejarlo fijo en `.env.test` es lo que
convertía al YAML del vault en una segunda fuente de verdad invisible para Git.

`FITZONE_VAULT_CONTRATO` pisa la ruta del vault para `exportar` y `verificar`,
que por defecto apuntan a la ruta de esta máquina.

## Archivos

- `openapi.yaml` — el contrato canónico.
- `exportar.ts` — copiar repo → vault, y verificar que no quedó viejo.
- `canonico.spec.ts` — valida el YAML canónico y que el vault coincida.
- `contrato.diff.spec.ts` — la comparación real contra el backend.
- `comparar.ts` / `alcance.ts` / `resolver.ts` — la lógica.
- `PERMITIDAS` — las 11 desviaciones aceptadas a propósito, en `comparar.ts`.