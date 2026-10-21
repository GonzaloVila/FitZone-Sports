# FitZone — Frontend

## Qué es

Cliente web de FitZone Sports: una SPA hecha con Vue 3, TypeScript, Vite, Vue Router y Pinia que consume la API REST del backend (contrato en `../docs/openapi.yaml`).

## Requisitos

- Node `^22.18.0` o `>=24.12.0`.
- El backend tiene que estar levantado (por defecto en `http://localhost:3000`, prefijo `/api/v1`), porque el frontend no funciona sin la API.

## Primeros pasos

```sh
npm install
cp .env.example .env
npm run dev
```

El servidor de desarrollo queda en `http://localhost:5173`.

## Scripts

- `npm run dev`: levanta el servidor de desarrollo de Vite con recarga en caliente.
- `npm run build`: corre el type-check y genera el build de producción en `dist/`.
- `npm run type-check`: chequea los tipos de los `.ts` y `.vue` con `vue-tsc`.
- `npm run types:api`: regenera `src/types/api.d.ts` a partir de `../docs/openapi.yaml`.

## Estructura de carpetas

```
src/
├── ui/            Kit de componentes, organizado por niveles (diseño atómico)
│   ├── atomos/
│   ├── moleculas/
│   ├── organismos/
│   ├── plantillas/
│   ├── tokens/
│   └── index.ts   API pública del kit
├── features/      Una carpeta por funcionalidad (sesion, socios)
│   └── <feature>/
│       ├── pages/
│       ├── components/
│       ├── composables/
│       ├── services/
│       └── stores/
├── compartido/    Utilidades y cosas sin dueño (por ejemplo, config.ts)
├── types/         Tipos generados desde la API
└── router/        Rutas de la aplicación
```

Regla de dependencias: **`ui/` no importa nada de `features/`**.

## Variables de entorno

Se definen en `frontend/.env`, que no se versiona. Se parte de `.env.example`.

| Variable | Descripción |
| --- | --- |
| `VITE_API_URL` | URL base de la API, incluido el prefijo `/api/v1` y sin barra final. Por defecto `http://localhost:3000/api/v1`. |

`src/compartido/config.ts` exporta `API_URL` y lanza un error claro si la variable falta. Después de cambiar el `.env` hay que reiniciar `npm run dev`.

## CORS

En desarrollo el origen del frontend es `http://localhost:5173`. El backend solo acepta los orígenes listados en su variable `CORS_ORIGINS` (separados por coma, sin comodín porque el CORS va con credenciales). Si usás otro host o puerto, agregalo ahí en el `.env` del backend:

```
CORS_ORIGINS=http://localhost:5173
```

## Tipos de la API

`src/types/api.d.ts` se genera con `npm run types:api` a partir de `../docs/openapi.yaml`. No se edita a mano: se vuelve a generar cada vez que cambia el contrato.

> TypeScript está fijado en 5.9 porque openapi-typescript declara un peer dependency de TypeScript 5. Subir a 6 cuando el generador lo soporte.

## Sesión

Pendiente, SCRUM-16.
