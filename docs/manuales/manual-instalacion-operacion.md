# Manual de instalación y operación — FitZone Sports

Cómo instalar, poner en marcha, respaldar, revertir y operar FitZone Sports. La estrategia de despliegue y sus motivos
están en [ADR-008](../adr/ADR-008.md); la de pruebas, en [ADR-007](../adr/ADR-007.md) y la [guía de pruebas](../pruebas.md).

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Puesta en marcha en entorno de desarrollo](#2-puesta-en-marcha-en-entorno-de-desarrollo)
3. [Puesta en marcha en entorno de producción](#3-puesta-en-marcha-en-entorno-de-producción)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Base de datos: migraciones, reversión y datos semilla](#5-base-de-datos-migraciones-reversión-y-datos-semilla)
6. [Despliegue: estrategia adoptada y procedimiento de reversión](#6-despliegue-estrategia-adoptada-y-procedimiento-de-reversión)
7. [Respaldo y restauración](#7-respaldo-y-restauración)
8. [Operación degradada: caída de la conexión principal y resincronización](#8-operación-degradada-caída-de-la-conexión-principal-y-resincronización)
9. [Alta de una sede nueva sin detener el sistema](#9-alta-de-una-sede-nueva-sin-detener-el-sistema)
10. [Monitoreo: registros y verificación de estado](#10-monitoreo-registros-y-verificación-de-estado)
11. [Resolución de problemas de instalación](#11-resolución-de-problemas-de-instalación)

---

## 1. Requisitos previos

### Para levantar el sistema completo (recomendado)

| Software | Versión | Para qué |
|---|---|---|
| Docker Engine | 24 o superior (probado con 29.8) | Construir y correr los contenedores |
| Docker Compose | v2 o superior (probado con v5.5) | Orquestar los cuatro servicios |
| Git | Cualquier versión reciente | Clonar el repositorio |

En Windows y macOS, Docker Engine y Compose vienen con **Docker Desktop**. No hace falta instalar Node.js ni PostgreSQL.

| Hardware | Mínimo |
|---|---|
| Memoria | 4 GB libres para Docker |
| Disco | 5 GB libres (imágenes: unos 1,4 GB la de migraciones, 700 MB la del backend, 75 MB la del frontend y 250 MB la de PostgreSQL) |
| Puertos libres | 3000 (API) y 8080 (aplicación web) |

### Para el entorno de desarrollo, además

| Software | Versión |
|---|---|
| Node.js | 22.18 o superior, o 24.12 o superior (las imágenes usan Node 24) |
| npm | La que trae Node.js |

### Versiones dentro de los contenedores

| Componente | Imagen |
|---|---|
| Base de datos | `postgres:16-alpine` |
| Backend | `node:24-alpine` (NestJS 12, Prisma 6) |
| Frontend | Build con `node:24-alpine`, servido con `nginx:1.27-alpine` |

## 2. Puesta en marcha en entorno de desarrollo

El modo desarrollo recarga el código en caliente al guardar. El backend y el frontend corren con Node en la máquina, y la
base corre en Docker.

1. Clonar el repositorio:
   ```bash
   git clone git@github.com:GonzaloVila/FitZone-Sports.git
   cd FitZone-Sports
   ```
2. Levantar una base local. El contenedor de pruebas sirve para desarrollar:
   ```bash
   docker compose -f docker-compose.test.yml up -d --wait
   ```
3. Configurar el backend: copiar `backend/.env.example` a `backend/.env` y completar `DATABASE_URL`.
   - Para la base local del paso 2:
     `postgresql://fitzone:fitzone@localhost:55432/fitzone_test?schema=public`
   - Para la base compartida del equipo (Supabase): la URL que corresponda.
4. Instalar dependencias, aplicar migraciones y cargar los datos de prueba:
   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npx prisma db execute --schema prisma/schema.prisma --file ../docs/db/seed_supabase_test_data.sql
   ```
   El seed **vacía las tablas** antes de insertar. No correrlo sobre una base con datos que se quieran conservar.
5. Configurar el frontend: copiar `frontend/.env.example` a `frontend/.env`. El valor por defecto apunta a la API local.
6. Levantar los dos servidores, cada uno en su terminal:
   ```bash
   cd backend && npm run start:dev      # API en http://localhost:3000/api/v1 · Swagger en /docs
   cd frontend && npm install && npm run dev   # Aplicación en http://localhost:5173
   ```

## 3. Puesta en marcha en entorno de producción

El sistema completo se levanta con Docker Compose desde la raíz del repositorio.

### En una máquina local o de evaluación

```bash
git clone git@github.com:GonzaloVila/FitZone-Sports.git
cd FitZone-Sports
docker compose up --build
```

La primera vez tarda unos minutos, porque construye las imágenes. Después:
1. `db` se levanta y queda sana;
2. `migraciones` aplica las migraciones y, **solo si la base no tiene sedes**, carga el seed (25 sedes y los usuarios de
   prueba del README), y termina;
3. `backend` arranca;
4. cuando el backend responde, arranca `frontend`.

| Recurso | Dirección |
|---|---|
| Aplicación web | http://localhost:8080 |
| API REST | http://localhost:3000/api/v1 |
| Documentación Swagger | http://localhost:3000/docs |

Para dejarlo corriendo en segundo plano: `docker compose up --build -d`. Para apagarlo: `docker compose down`, que
conserva los datos del volumen `datos-postgres`.

### En un servidor con dominio propio

Los valores por defecto sirven **solo** para una máquina local. En un servidor:

1. Crear un archivo `.env` en la raíz, a partir de `.env.example`, con:
   - `POSTGRES_PASSWORD`, `JWT_SECRET` y `TOTP_ENCRYPTION_KEY` propios y aleatorios (ver sección 4);
   - `URL_WEB` y `URL_API` con las direcciones públicas.
2. Publicar la aplicación detrás de un proxy con HTTPS (por ejemplo nginx o Caddy con Let's Encrypt) y poner
   `REFRESH_COOKIE_SECURE=true`.
3. `docker compose up --build -d`.

Si se cambia `URL_API`, hay que reconstruir el frontend (`docker compose up --build -d frontend`): la dirección de la API
queda fija al compilarlo.

## 4. Variables de entorno

### `docker-compose.yml` (archivo `.env` en la raíz, ver `.env.example`)

Todas son opcionales: sin `.env`, el sistema levanta en local con los valores por defecto.

| Variable | Para qué sirve | Valor de ejemplo | ¿Obligatoria? |
|---|---|---|---|
| `POSTGRES_USER` | Usuario de la base | `fitzone` | No (default `fitzone`) |
| `POSTGRES_PASSWORD` | Contraseña de la base | una contraseña larga | No en local; **sí en un servidor** |
| `POSTGRES_DB` | Nombre de la base | `fitzone` | No (default `fitzone`) |
| `JWT_SECRET` | Firma de los tokens de sesión | 64 caracteres aleatorios | No en local; **sí en un servidor** |
| `TOTP_ENCRYPTION_KEY` | Clave AES-256 que cifra el secreto del QR de cada socio | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | No en local; **sí en un servidor** |
| `URL_WEB` | Dirección de la aplicación web; el backend solo acepta pedidos (CORS) desde ahí | `http://localhost:8080` | No |
| `URL_API` | Dirección de la API con la que se compila el frontend | `http://localhost:3000/api/v1` | No |
| `REFRESH_COOKIE_SECURE` | La cookie de sesión exige HTTPS | `false` en local, `true` con HTTPS | No |

### Backend (`backend/.env` en desarrollo; en Docker las arma el compose)

| Variable | Para qué sirve | Valor de ejemplo | ¿Obligatoria? |
|---|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://fitzone:fitzone@localhost:55432/fitzone_test?schema=public` | **Sí** |
| `NODE_ENV` | Entorno: `development`, `test` o `production` | `development` | No |
| `PORT` | Puerto HTTP de la API | `3000` | No (default 3000) |
| `JWT_SECRET` | Firma de los tokens de sesión | (ver arriba) | No en desarrollo |
| `JWT_EXPIRES_IN` | Segundos de vida del token de acceso | `900` | No (default 900) |
| `REFRESH_EXPIRES_IN` | Segundos de vida de la sesión (refresh token) | `604800` | No (default 7 días) |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma | `http://localhost:5173` | No |
| `REFRESH_COOKIE_SAMESITE` | `strict`, `lax` o `none` | `lax` | No |
| `REFRESH_COOKIE_SECURE` | La cookie exige HTTPS | `false` | No (default: `true` solo en `production`) |
| `TOTP_ENCRYPTION_KEY` | Cifrado del secreto TOTP de los socios | (ver arriba) | No en desarrollo |
| `MP_TOKEN` | Token de la pasarela real (no se usa: la pasarela es simulada) | vacío | No |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Envío real de los avisos de cupo liberado (RF-08) | `smtp.gmail.com`, `587`, … | No: sin ellos, el aviso solo se registra en el log |
| `ETHEREAL` | `true` usa una casilla de prueba de Ethereal y registra la URL de vista previa del mail | `false` | No |
| `PASARELA_MOCK` | Solo pruebas: fuerza el resultado de los cobros internos (`APROBADO`, `PENDIENTE` o `RECHAZADO`) | vacío | No; no usar en producción |

### Frontend (`frontend/.env` en desarrollo)

| Variable | Para qué sirve | Valor de ejemplo | ¿Obligatoria? |
|---|---|---|---|
| `VITE_API_URL` | Dirección de la API, con el prefijo `/api/v1` y sin barra final | `http://localhost:3000/api/v1` | **Sí** (sin ella la app avisa y no arranca) |

Ningún `.env` se sube al repositorio. Solo se versionan los `.env.example`.

## 5. Base de datos: migraciones, reversión y datos semilla

El esquema vive en `backend/prisma/schema.prisma` y sus cambios en `backend/prisma/migrations/`, en orden. Todo cambio de
esquema se hace con una migración nueva; nunca editando una migración ya aplicada.

### Aplicar migraciones

- **Con Docker:** el servicio `migraciones` las aplica solo en cada `docker compose up`.
- **A mano:** `cd backend && npx prisma migrate deploy`. Usa la `DATABASE_URL` del entorno.
- **Ver el estado:** `npx prisma migrate status`.

### Crear una migración nueva (desarrollo)

Contra una base local, nunca contra la compartida:
```bash
cd backend
npx prisma migrate dev --name descripcion_del_cambio
```
Genera la carpeta de la migración, la aplica y regenera el cliente de Prisma. La carpeta se commitea junto con el cambio
del esquema.

### Revertir una migración

Las migraciones de Prisma solo avanzan: no tienen un paso automático hacia atrás. Hay dos caminos:
- **Sin pérdida de datos:** escribir una migración nueva que deshaga el cambio (por ejemplo, volver a agregar una
  columna) y aplicarla como cualquier otra.
- **Si la migración dañó datos:** restaurar el respaldo tomado antes de aplicarla (sección 7).

Si una migración falla a mitad de camino, Prisma la marca como fallida y no deja aplicar otras. Después de corregir la
base a mano o restaurar el respaldo, se la marca con `npx prisma migrate resolve --rolled-back <nombre_de_la_migracion>`
y se vuelve a intentar.

### Datos semilla

`docs/db/seed_supabase_test_data.sql` carga:
- 25 sedes: las tres originales (Belgrano, Palermo y Caballito) con los datos de ejemplo, y las 22 restantes con dos
  canchas, dos clases y un recepcionista cada una;
- 25 socios, uno de ellos en mora;
- el gerente y los clientes externos;
- reservas, pagos e ingresos de ejemplo.

Todos los usuarios tienen la contraseña `Password123!`; las credenciales principales están en la sección 4 del README.

El seed **vacía todas las tablas** antes de insertar. Por eso Docker lo carga solo cuando la base no tiene sedes. Para
volver a los datos de prueba desde cero: `docker compose down -v` y `docker compose up`. **Esto borra todos los datos.**

## 6. Despliegue: estrategia adoptada y procedimiento de reversión

Detalle y alternativas en [ADR-008](../adr/ADR-008.md). En resumen:

| Servicio | Qué hace |
|---|---|
| `db` | PostgreSQL 16, con los datos en el volumen `datos-postgres` |
| `migraciones` | Migraciones y seed (solo con la base vacía); usa la etapa de build del backend, que tiene el CLI de Prisma |
| `backend` | API NestJS, imagen con solo las dependencias de producción y un usuario sin privilegios |
| `frontend` | Build de Vite servido con nginx, con fallback a `index.html` para el router |

Cada push a `main` corre el pipeline de GitHub Actions (`.github/workflows/ci.yml`), que también verifica que
`docker compose up --build` levante el sistema y responda.

### Desplegar una versión nueva

1. Respaldar la base si la versión trae migraciones (sección 7).
2. Traer el código: `git pull`.
3. Reconstruir y reiniciar: `docker compose up --build -d`. Las migraciones nuevas se aplican solas antes de que arranque
   el backend.

### Revertir un despliegue

1. Volver el código al último estado sano:
   - `git revert <commit>` para deshacer un cambio puntual; o
   - `git checkout v1.0-entrega` para volver a la versión entregada.
2. Reconstruir: `docker compose up --build -d`.
3. Si además una migración dañó datos, restaurar el respaldo (sección 7) **antes** de reconstruir.

## 7. Respaldo y restauración

### Respaldar

Con el sistema levantado:
```bash
docker compose exec -T db pg_dump -U fitzone -d fitzone > respaldo-AAAA-MM-DD.sql
```
El archivo tiene el esquema, los datos y el historial de migraciones. Guardarlo fuera del servidor.

### Restaurar

Sobre una base vacía:
```bash
docker compose down -v                                              # borra el volumen actual
docker compose up -d --wait db                                      # solo la base, vacía
docker compose exec -T db psql -U fitzone -d fitzone < respaldo-AAAA-MM-DD.sql
docker compose up --build -d                                        # el resto del sistema
```
Como la base restaurada ya tiene sedes, el seed no se vuelve a cargar, y las migraciones que el respaldo ya tenía no se
repiten. Este procedimiento se probó completo: un dato agregado antes del respaldo sobrevivió al borrado total y a la
restauración.

## 8. Operación degradada: caída de la conexión principal y resincronización

El control de acceso de la sede tiene que seguir funcionando aunque se corte internet (RNF-01). Ver
[ADR-003](../adr/ADR-003.md).

### Antes del corte

- El puesto de control trabaja en **Acceso**, con la sesión iniciada por el RECEPCION o el GERENTE.
- Al abrir esa pantalla, el navegador descarga la **lista de socios inhabilitados** (membresía vencida o suspendida) y la
  guarda en el equipo.
- La aplicación queda instalada como PWA: se puede reabrir sin conexión.

### Durante el corte

- El encabezado de **Acceso** muestra la insignia **"Sin conexión"**.
- Al registrar un ingreso:
  - si el socio está en la lista local de inhabilitados, se **rechaza en el momento** ("La membresía no está vigente o
    está suspendida"), con el motivo y la fecha;
  - si no, el ingreso se **guarda en la cola local del puesto** y se informa como "Ingreso registrado sin conexión".
    La insignia de pendientes muestra cuántos hay.
- Los datos quedan en el almacenamiento del navegador: no se pierden aunque se cierre la pestaña.

**Límite:** la sesión no se puede iniciar sin conexión, porque el token se renueva contra el servidor. El modo offline
sirve si el puesto ya tenía la sesión abierta cuando se cortó la red.

### Al volver la conexión

- La aplicación lo detecta sola: la insignia vuelve a **"En línea"**.
- Envía la cola completa al servidor (`POST /api/v1/sincronizacion/ingresos`) y actualiza el aforo. También se puede
  forzar con el botón **"Sincronizar pendientes"**.
- El servidor valida cada ingreso. Los aceptados salen de la cola; los rechazados (por ejemplo, un código del carnet
  vencido o un socio que ya estaba dentro de otra sede) **quedan en la cola** para revisarlos.
- La lista de inhabilitados se actualiza con los cambios desde la última sincronización.

## 9. Alta de una sede nueva sin detener el sistema

Las sedes son datos, no configuración: se agregan con el sistema funcionando, sin reiniciar ni desplegar nada (RNF-04).

1. Iniciar sesión como **GERENTE**.
2. Ir a **Acceso** y pulsar **"Nueva sede"**. Completar nombre, dirección y capacidad máxima, y guardar. La sede aparece
   enseguida en todos los selectores.
3. Ir a **Personal** y dar de alta al recepcionista de la sede. El alta solo ofrece las sedes que todavía no tienen uno.
4. Ir a **Canchas** y pulsar **"Nueva cancha"** para cargar sus canchas, con deporte y costo por hora.
5. Ir a **Clases** y pulsar **"Nueva clase"** para cargar su agenda.

También se puede hacer por la API: `POST /api/v1/sedes` (solo GERENTE), documentado en Swagger.

## 10. Monitoreo: registros y verificación de estado

### Estado de los servicios

```bash
docker compose ps
```
- `db` y `backend` tienen healthcheck: tienen que figurar como `healthy`.
- `migraciones` tiene que figurar como `exited (0)`: terminó bien.
- Un servicio que se cae se reinicia solo (`restart: unless-stopped`).

| Chequeo | Comando o dirección | Resultado esperado |
|---|---|---|
| La API responde | http://localhost:3000/docs | Swagger UI |
| El contrato está publicado | http://localhost:3000/docs-json | El JSON de OpenAPI |
| La web responde | http://localhost:8080 | La pantalla de inicio de sesión |
| La base responde | `docker compose exec db pg_isready -U fitzone` | `accepting connections` |

### Registros

```bash
docker compose logs -f backend        # la API: arranque, errores y avisos de los procesos programados
docker compose logs migraciones       # qué migraciones se aplicaron y si se cargó el seed
docker compose logs -f frontend       # los pedidos que recibe nginx
```

El sistema no tiene un tablero de métricas propio: el estado se verifica con los healthchecks y los registros. En un
entorno real se sumaría una herramienta de monitoreo (deuda registrada en ADR-008).

## 11. Resolución de problemas de instalación

| Síntoma | Causa | Solución |
|---|---|---|
| `failed to connect to the docker API` o `Docker Desktop is unable to start` | Docker Desktop está cerrado o se detuvo. | Abrirlo (o reiniciarlo), esperar a que diga *Engine running* y repetir. |
| `port is already allocated` en 3000 u 8080 | Otro programa usa ese puerto (por ejemplo, el backend de desarrollo). | Cerrarlo, o cambiar el puerto publicado en `docker-compose.yml`. |
| El servicio `migraciones` termina con error y el backend no arranca | Una migración falló, o la base no estaba lista. | `docker compose logs migraciones`. Ver la sección 5 (migraciones fallidas). |
| Docker arranca pero no aparecen los usuarios de prueba | La base ya tenía datos, así que el seed no se cargó. | Es lo esperado. Para volver a los datos de prueba: `docker compose down -v` y `docker compose up` (borra los datos). |
| La web abre pero el login falla con un error de red o de CORS | `URL_WEB` no coincide con la dirección desde la que se abre la app, o `URL_API` no es la de la API. | Ajustar `.env` y reconstruir: `docker compose up --build -d`. |
| Inicia sesión y al recargar la página vuelve al login | `REFRESH_COOKIE_SECURE=true` con la app servida por `http`. | En local, `REFRESH_COOKIE_SECURE=false`; en un servidor, servir por HTTPS. |
| Desarrollo: `Falta la variable VITE_API_URL` | Falta `frontend/.env`. | Copiar `frontend/.env.example` a `frontend/.env` y reiniciar `npm run dev`. |
| Desarrollo: `Can't reach database server` | La base local no está levantada o `DATABASE_URL` apunta a otra. | `docker compose -f docker-compose.test.yml up -d --wait` y revisar `backend/.env`. |
| Desarrollo: `tenant/user … not found` contra Supabase | El proyecto de Supabase cambió. | Pedir la `DATABASE_URL` vigente al equipo, o usar la base local. |
| Las pruebas fallan en Windows con `reading 'config'` | La terminal está en `c:\…` con minúscula. | Abrir la terminal en `C:\…` (ver la [guía de pruebas](../pruebas.md)). |
