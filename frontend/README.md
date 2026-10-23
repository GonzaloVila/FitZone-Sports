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

## Capa de servicios y raíz de composición

- **Cliente HTTP** (`src/compartido/http/`): `clienteApi.ts` crea un cliente de `openapi-fetch` tipado con `paths` de `src/types/api.d.ts`. Manda la cookie de refresh (`credentials: 'include'`) y el `Authorization: Bearer`, y ante un 401 renueva el acceso una sola vez y reintenta. `almacenToken.ts` guarda el access token solo en memoria. `errores.ts` define `ErrorApi` (`status` y `problema` del contrato; status 0 si no hay conexión).
- **Servicios** (`src/features/<feature>/services/`): una función por operación del contrato, sin estado de Vue ni reglas de negocio. Usan `desenvolver()` para obtener los datos o recibir un `ErrorApi`. Hoy existe `servicioSesion.ts`.
- **Raíz de composición** (`src/main.ts`): es el único que conoce las implementaciones concretas (y el único que importa `API_URL`). Crea el almacén, el cliente y los servicios y los publica con `app.provide(ServiciosKey, ...)`.
- **Uso desde las features:** `useServicios()` (`src/compartido/servicios.ts`), solo desde `setup` o composables, nunca desde funciones de lógica.
- **`ui/` nunca usa servicios:** el kit de componentes no sabe que existe una API.

## Sesión y rutas protegidas

- **Quién guarda qué:** el access token vive solo en memoria (`compartido/http/almacenToken.ts`) y el refresh token en la cookie HttpOnly que maneja el backend. El store `features/sesion/stores/sesionStore.ts` guarda solo el usuario (`rol`, `sedeId`, `socioId`); nada va a `localStorage` ni a otro storage.
- **Quién habla con el servicio:** solo `LoginPage`, a través de `useIniciarSesion()` y el store. Las páginas no usan `fetch`.
- **Rutas:** cada ruta declara su `meta` en `src/router/index.ts`: `publica: true` (login), `roles: [...]` (por ejemplo `/socios` para `RECEPCION` y `GERENTE`) o nada (`/inicio` solo requiere sesión). Un rol desconocido se trata como sin permisos.
- **Guard global:** en la primera navegación intenta restaurar la sesión con la cookie (F5); sin sesión manda a `/login?redirect=<ruta>`; con sesión, `/login` y las rutas no permitidas llevan a la ruta inicial del rol (`RECEPCION` y `GERENTE` a `/socios`; `SOCIO` y `EXTERNO` a `/inicio`).
- **Sesión vencida:** si no se puede renovar el acceso, `main.ts` limpia el store y lleva a `/login`.
- **Restricciones de rol:** las restricciones del front son solo de navegación (UX); la autorización real la hace el backend.
