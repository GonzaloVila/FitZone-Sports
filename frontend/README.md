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
├── app/           Composición de la aplicación (armazón); puede importar de features/ y ui/
├── features/      Una carpeta por funcionalidad (sesion, inicio, socios, sedes, usuarios)
│   └── <feature>/
│       ├── rutas.ts   Rutas de la feature (RouteRecordRaw[])
│       ├── pages/
│       ├── components/
│       ├── composables/
│       ├── services/
│       └── stores/
├── compartido/    Utilidades y cosas sin dueño (por ejemplo, config.ts)
├── types/         Tipos generados desde la API
└── router/        Router: junta las rutas de cada feature y define el guard
```

Reglas de dependencias: **`ui/` no importa nada de `features/`, `app/` ni `compartido/`**; las páginas no usan `fetch`; solo el store de sesión toca la sesión.

Una feature puede importar composables y tipos de otra feature (por ejemplo, `socios` usa `useSedes` de `sedes`), pero nunca sus páginas, componentes ni stores, y no puede haber ciclos entre features. Los datos de la sesión (rol, `socioId`) se leen con el composable `useUsuarioSesion()` de `sesion`, no con su store.

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
- **Quién habla con el servicio:** solo el store. `LoginPage` lo usa a través de `useIniciarSesion()` y el armazón (`app/ArmazonApp.vue`) a través de `cerrarSesion()` del store. Las páginas no usan `fetch`.
- **Rutas:** cada ruta declara su `meta` en el `rutas.ts` de su feature: `publica: true` (login), `roles: [...]` (por ejemplo `/socios` para `RECEPCION` y `GERENTE`) o nada (`/inicio` solo requiere sesión). Un rol desconocido se trata como sin permisos.
- **Guard global:** en la primera navegación intenta restaurar la sesión con la cookie (F5); sin sesión manda a `/login?redirect=<ruta>`; con sesión, `/login` y las rutas no permitidas llevan a la ruta inicial del rol (`RECEPCION` y `GERENTE` a `/socios`; `SOCIO` a `/carnet`; `EXTERNO` a `/inicio`).
- **Ruta inexistente:** la comodín (`no-encontrada`) redirige a `/login`; si hay sesión, el guard reubica a la ruta inicial del rol. Un `?redirect` que apunte a una ruta inexistente se ignora.
- **Sesión vencida:** si no se puede renovar el acceso, `main.ts` limpia el store y lleva a `/login`.
- **Restricciones de rol:** las restricciones del front son solo de navegación (UX); la autorización real la hace el backend.

## Rutas por módulo y armazón

- **Rutas por módulo:** cada feature exporta sus rutas en `features/<x>/rutas.ts` (`RouteRecordRaw[]`) y `src/router/index.ts` solo las junta con spread. Así, dos personas que agregan módulos distintos no editan las mismas líneas.
- **`meta` de las rutas:** `publica` (sin sesión), `roles` (quiénes pueden entrar; sin `roles`, basta con tener sesión) y `navegacion: { etiqueta, orden }` (la ruta aparece como link en el armazón, solo a los roles que pueden entrar).
- **Armazón:** las rutas autenticadas son hijas de una ruta padre que renderiza `src/app/ArmazonApp.vue`. Ese componente arma la plantilla presentacional `PlantillaAppFz` (de `ui/plantillas/`) con el nombre de la app, los links de navegación y el botón "Cerrar sesión". `/login` queda fuera del armazón. Los links se construyen desde las rutas con `meta.navegacion`, filtradas por rol y ordenadas por `orden`: no hay una lista escrita a mano.
- **Accesibilidad del armazón:** landmarks `header`, `nav` (con `aria-label`) y `main`, enlace "Saltar al contenido", `aria-current="page"` en el link activo y foco visible. En ancho chico los links envuelven en varias líneas.
- **Cerrar sesión:** el botón llama a `cerrarSesion()` del store; si falla el aviso al servidor igual se limpia la sesión local y se va a `/login`.

### Cómo agregar un módulo

1. Crear la carpeta `src/features/<modulo>/` con sus `pages/`, `components/`, `composables/`, `services/` y `stores/` (las que haga falta).
2. Crear `src/features/<modulo>/rutas.ts` exportando un `RouteRecordRaw[]` con los paths, el `name` y el `meta` (`roles` si la ruta tiene restricción).
3. Si la ruta debe aparecer en el menú, agregarle `meta.navegacion: { etiqueta, orden }`.
4. Sumar las rutas con spread en `children` de la ruta del armazón en `src/router/index.ts`.

## Lista de socios

Pantalla `/socios` (RECEPCION y GERENTE): filtros por nombre, estado, plan y sede, tabla y paginación.

- **Dónde vive cada cosa:**
  - `features/socios/services/servicioSocios.ts` y `features/sedes/services/servicioSedes.ts`: una función por operación del contrato (`listarSocios`, `obtenerMembresia`, `listarSedes`). Se construyen en `main.ts` y llegan por `useServicios()` (`servicios.socios`, `servicios.sedes`).
  - `features/socios/composables/useListaSocios.ts`: estado de la lista (filtros, página, items, total, `cargando`, `error`). El nombre se aplica con debounce de 300 ms; cambiar un filtro vuelve a la página 1; una respuesta vieja se descarta (cada consulta tiene un número y un `AbortController`).
  - `features/sedes/composables/useSedes.ts`: carga una vez todas las sedes (el contrato las pagina, con `perPage` máximo 100) para el filtro y para mostrar el nombre de la sede.
  - `features/socios/components/` (`FiltrosSocios`, `TablaSocios`): reciben props y emiten eventos (`v-model`). `features/socios/presentacion.ts` define cómo se muestran los valores del contrato (etiquetas, variantes de insignia, fecha en `es-AR`).
  - `GestionSociosPage` solo usa los composables y compone los componentes; no usa `fetch`.
- **Limitación conocida del contrato:** `SocioOut` (y `ListaSocios`) **no trae el plan ni el estado de la membresía**, aunque `listarSocios` sí permite filtrar por ellos. Por eso, por cada página se pide `obtenerMembresia` de cada fila (hasta 4 en paralelo, 10 filas por página). Si una falla, solo esa fila muestra "No disponible". Si el contrato sumara plan y estado al listado, ese N+1 desaparece.
- **Componentes nuevos del kit** (`ui/`, exportados desde `ui/index.ts`):
  - `SelectFz` (átomo): `<select>` nativo con el estilo de `CampoTextoFz`.
  - `PaginacionFz` (molécula): `<nav>` con Anterior/Siguiente y "Página X de Y"; `v-model` de la página.
  - `TablaFz` (organismo): `<table>` semántica con `<caption>` (opcionalmente oculto), `scope` en los encabezados y un slot `celda-<clave>` por columna. Es genérica y no conoce el dominio.
- **Regla:** el mapeo del dominio (por ejemplo, ACTIVA = verde) vive en `features/`; el kit solo recibe variantes genéricas (`exito`, `peligro`, `advertencia`, `neutra`).

## Detalle del socio, alta y carnet

**Rutas** (todas en `features/socios/rutas.ts`):

| Ruta | Quién | Qué es |
| --- | --- | --- |
| `/socios` | RECEPCION, GERENTE | Lista (con el botón "Nuevo socio") |
| `/socios/nuevo` | RECEPCION, GERENTE | Alta de socio |
| `/socios/:socioId` | RECEPCION, GERENTE | Detalle y acciones. Un id que no sea un entero positivo se trata como socio inexistente, sin pedir nada a la API |
| `/carnet` | SOCIO | "Mi carnet", con el QR de acceso |

- **Detalle** (`DetalleSocioPage`, `useDetalleSocio`): carga el socio y su membresía en paralelo y, apenas conoce el `usuarioId`, el usuario (DNI y teléfono). Si la membresía o el usuario fallan, solo ese dato dice "No disponible". Acciones, cada una con un `ModalFz` de confirmación: suspender, reactivar (solo si está suspendida), cambiar plan (abre un período nuevo desde hoy y puede devolver un 402), activar o desactivar la renovación automática, cambiar la sede de origen y dejar de ser socio (elimina la membresía, el usuario vuelve a EXTERNO y el historial de reservas y pagos se conserva). Una membresía VENCIDA no se reactiva: se resuelve con "Cambiar plan". Mientras hay una acción en curso no se dispara otra y el modal no se cierra. Al terminar bien se actualiza el estado con la respuesta del servidor.
- **Alta** (`NuevoSocioPage`, `useAltaSocio`): paso 1, elegir un usuario existente (se busca entre los de rol EXTERNO por nombre o por email exacto) o crear uno nuevo; paso 2, sede y plan. La validación en el cliente es solo ayuda de uso; los errores del servidor (409, 422) se asocian al campo cuando el contrato lo permite. **Por qué no se recrea el usuario al reintentar:** el alta son dos llamadas (`crearUsuario` y después `crearSocio`). Si la segunda falla, el usuario ya existe: pasa a ser el "usuario seleccionado" y el reintento solo repite `crearSocio`. Recrearlo daría un 409 por DNI o email repetidos. La contraseña se limpia apenas se envía el usuario y al salir de la página.
- **Carnet** (`CarnetPage`, `useCarnet`): datos del socio de la sesión (`useUsuarioSesion().socioId`) con `CarnetSocio`. **El QR no se pide al cargar la página:** `registrarQr` crea o *sobrescribe* el secreto TOTP del socio, así que solo se llama después de una confirmación explícita, avisando que hay que volver a configurar la app de autenticación. La URI y el secreto viven solo en memoria del componente (ni store, ni storage, ni consola) y se descartan al salir. El QR es para vincular la app de autenticación; el código de ingreso lo genera esa app. El contrato no devuelve el secreto como campo aparte: para la carga manual se extrae del parámetro `secret` de la URI `otpauth://`.
- **Navegación:** el menú muestra "Inicio" a todos, "Mi carnet" al SOCIO y "Socios" a RECEPCION y GERENTE; "Socios" queda resaltado también en `/socios/:id` y `/socios/nuevo`.
- **Kit:** `ModalFz` (organismo, `<dialog>` nativo con `showModal()`, título con `aria-labelledby`, Esc, devuelve el foco, no se cierra con una acción en curso) y `QrFz` (átomo, genera el QR como imagen con `alt`).
- **Dependencia `qrcode`:** `QrFz` genera el QR en el navegador con `qrcode` (1.5.4, versión exacta; `@types/qrcode` 1.5.6 como devDependency). Se justifica porque codificar un QR a mano es inviable y la URI otpauth contiene el secreto, que no debe salir del navegador hacia un servicio externo.
