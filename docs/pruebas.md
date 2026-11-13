# Pruebas — FitZone Sports

Cómo correr la suite de pruebas, qué prueba cada capa y cómo leer los resultados. La estrategia y sus motivos están en
[ADR-007](adr/ADR-007.md).

## 1. La pirámide de un vistazo

| Capa | Qué prueba | Dónde vive | Comando | ¿Docker? | Cantidad |
|---|---|---|---|---|---|
| Unitarias del backend | La lógica de cada service y entidad, con la base reemplazada por mocks | `backend/src/**/*.spec.ts` | `cd backend && npm test` | No | 670 |
| Unitarias y de componentes del frontend | Composables, servicios, componentes y pantallas, en un navegador simulado (jsdom) | `frontend/src/**/*.spec.ts` | `cd frontend && npm test` | No | 1254 |
| Integración | Las garantías que solo da PostgreSQL: constraints, índices, transacciones y concurrencia | `backend/src/**/*.integration-spec.ts` | `cd backend && npm run test:integration` | Sí | 82 |
| API por HTTP | Cada endpoint del contrato: códigos de estado, permisos por rol y cuerpos de error | `backend/test/api/**/*.api-spec.ts` | `cd backend && npm run test:api` | Sí | 189 |
| E2E | Un recorrido de usuario por requisito, en un navegador real contra el sistema completo | `e2e/tests/*.spec.ts` | `cd e2e && npm test` | Sí | 17 |

Las pruebas de concurrencia que pide la Unidad V están en dos capas:
- **Integración:** RN-01 (un socio en dos sedes) y RN-02 (dos reservas del mismo turno), con intentos simultáneos contra la base.
- **E2E:** RN-02 con dos navegadores que confirman el mismo turno al mismo tiempo.

## 2. Antes de empezar

- **Node.js 22.18 o superior** y las dependencias instaladas (`npm install` en `backend/`, `frontend/` y `e2e/`).
- **Docker Desktop abierto**, solo para integración, API y E2E. Las unitarias no lo necesitan.
- **E2E, solo la primera vez:** `cd e2e && npm run instalar-navegador` descarga Chromium (unos 120 MB).
- **En Windows:** abrir la terminal en la ruta con la unidad en mayúscula (`C:\...`). Con `c:\...` en minúscula, Vitest
  falla al arrancar con `Cannot read properties of undefined (reading 'config')`.

### Las bases de prueba

Integración, API y E2E usan un PostgreSQL 16 en Docker (`docker-compose.test.yml`, puerto 55432), nunca la base
compartida de Supabase.
- Los datos viven en memoria: al recrear el contenedor arranca vacío.
- Si la URL de la base no es local, la configuración de pruebas frena la corrida.

Dentro del contenedor hay dos bases:

| Base | La usan | Cómo se prepara |
|---|---|---|
| `fitzone_test` | Integración y API | La primera vez, `cp .env.test.example .env.test`; después, `npm run test:db:up` y `npm run test:db:migrate` (en `backend/`). Cada prueba crea sus datos y los borra al terminar. |
| `fitzone_e2e` | E2E | Sola, al correr `npm test` en `e2e/`: crea la base si falta, aplica las migraciones y carga el seed (`docs/db/seed_supabase_test_data.sql`). Cada corrida arranca del mismo estado. |

## 3. Cómo correr cada capa

### Backend

```bash
cd backend
npm test                   # unitarias, con el detalle de cada prueba
npm run test:cov           # unitarias + tabla de cobertura (falla si baja del umbral)
npm run test:db:up         # levanta el Postgres de pruebas y espera a que esté listo
npm run test:db:migrate    # aplica las migraciones a fitzone_test
npm run test:integration   # integración
npm run test:api           # API por HTTP (Supertest)
npm run test:all           # cobertura + integración + API, en ese orden
```

### Frontend

```bash
cd frontend
npm test                   # unitarias y de componentes
npm run test:cov           # lo mismo + tabla de cobertura (falla si baja del umbral)
npm run type-check         # tipos de la app y de los specs
```

### E2E

```bash
cd e2e
npm test                                          # los 17 recorridos (unos 2,5 minutos)
npx playwright test m4-canchas                    # solo un archivo (un módulo)
npx playwright test -g "RN-02"                    # solo un recorrido, por el código del requisito
npx playwright test -g "RN-02" --headed           # lo mismo, con el navegador visible
```

`npm test` levanta solo el backend (puerto 3100) y el frontend (puerto 5180) apuntando a `fitzone_e2e`, y los apaga al
terminar. No chocan con los servidores de desarrollo (3000 y 5173).

Las corridas parciales con `npx playwright test` no vuelven a cargar el seed. Para empezar de cero, antes:
`npm run preparar`.

## 4. Cómo leer los resultados

### Vitest (unitarias, integración, API)

Cada prueba aparece con ✓ si pasó y ✗ si falló. Al final está el resumen:

```
 Test Files  73 passed (73)
      Tests  670 passed (670)
```

Si una falla, Vitest muestra el valor esperado (`Expected`), el que se obtuvo (`Received`) y la línea del spec.

### La tabla de cobertura

`npm run test:cov` muestra una tabla en la terminal con un renglón por archivo y uno de total (`All files`):

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   71.29 |    66.84 |   64.22 |   71.49 |
 socios.service.ts |     100 |    94.44 |     100 |     100 | 88
```

| Columna | Qué mide |
|---|---|
| `% Stmts` (sentencias) | Qué parte de las instrucciones se ejecutó durante las pruebas. |
| `% Branch` (ramas) | Qué parte de los caminos de cada `if`, `?:`, `??` o `switch` se recorrió, por ejemplo el `if` y también el `else`. |
| `% Funcs` (funciones) | Qué parte de las funciones se llamó al menos una vez. |
| `% Lines` (líneas) | Qué parte de las líneas con código se ejecutó. |
| `Uncovered Line #s` | Las líneas que ninguna prueba ejecutó: es el lugar donde mirar para agregar una prueba. |

Los colores marcan cada valor contra un rango orientativo: verde alto, amarillo medio, rojo bajo. Lo que decide si la
corrida pasa es el **umbral** configurado en Vitest. Si el total baja de él, el comando termina con error y lo dice
(`ERROR: Coverage for lines (68%) does not meet global threshold (70%)`).

| Suite | Líneas | Sentencias | Ramas | Funciones |
|---|---|---|---|---|
| Unitarias del backend | 70 % | 70 % | 65 % | 60 % |
| Frontend | 82 % | 80 % | 72 % | 72 % |

La cobertura se mide sobre las unitarias. Las otras capas prueban otra cosa (la base, el contrato, el recorrido del usuario)
y no suman al porcentaje (ADR-007).

### Playwright (E2E)

Cada recorrido aparece con `ok` y su duración. El nombre empieza con el requisito que prueba:

```
  ok 5 [chromium] › tests\m4-canchas.spec.ts › RN-02 · dos usuarios confirman el mismo turno a la vez y solo uno lo consigue (7.2s)
  17 passed (2.5m)
```

Si uno falla, Playwright muestra el paso que falló y guarda en `e2e/test-results/<recorrido>/`:
- `test-failed-*.png`: capturas de cada pestaña al fallar;
- `error-context.md`: el contenido de la página en ese momento;
- `trace.zip`: la grabación paso a paso, que se abre con `npx playwright show-trace <ruta del trace.zip>`.

`test-results/` no se sube al repositorio.

## 5. Mapa de los recorridos E2E

| Requisito | Archivo | Qué recorre |
|---|---|---|
| RF-01 | `m1-socios` | La recepción da de alta un socio nuevo y ese socio entra a su carnet. |
| RF-02 | `m1-socios` | Filtro de membresías vencidas; el gerente suspende y reactiva a un socio. |
| RF-03 | `m2-acceso` | Una socia de Belgrano ingresa a Palermo. |
| RF-04 | `m2-acceso` | El socio genera su QR; la recepción valida el código. Un código inválido se rechaza. |
| RF-05 | `m2-acceso` | El aforo sube con el ingreso y baja con el egreso. |
| RF-06 | `m3-clases` | El gerente crea una clase y aparece en la agenda. |
| RF-07 | `m3-clases` | El socio reserva (el cupo baja) y cancela sin penalidad. |
| RF-08 | `m3-clases` | Clase llena → lista de espera → se libera el cupo → aviso → confirmación. |
| RF-09 | `m4-canchas` | El gerente da de alta una cancha. |
| RF-10 | `m4-canchas` | Un turno reservado aparece ocupado para otro usuario. |
| RF-11 | `m4-canchas` | Precio con descuento de socio y recargo de horario pico. |
| RF-12 | `m4-canchas` | Una cancha en mantenimiento no admite reservas. |
| RF-13 | `m5-pagos` | Tarjeta rechazada y reintento aprobado. |
| RF-14 | `m5-pagos` | Descarga del comprobante en PDF; el pago figura en "Mis pagos". |
| RN-01 | `m2-acceso` | Un socio dentro de una sede no puede ingresar a otra. |
| RN-02 | `m4-canchas` | Dos navegadores confirman el mismo turno a la vez: solo uno lo consigue. |
| RN-03 | `rn-03-socio-en-mora` | El socio en mora no reserva clases y paga la cancha sin descuento. |

## 6. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `failed to connect to the docker API … dockerDesktopLinuxEngine` | Docker Desktop está cerrado. | Abrirlo, esperar a que diga *Engine running* y repetir. |
| `Cannot read properties of undefined (reading 'config')` en todas las pruebas | Windows: la terminal está en `c:\…` con minúscula. | Abrir la terminal en `C:\…`. |
| Integración o API fallan con errores de tablas o columnas | La base de pruebas no tiene las últimas migraciones (por ejemplo, se recreó el contenedor). | `npm run test:db:migrate` en `backend/`. |
| La corrida se frena diciendo que la base no es local | `DATABASE_URL` apunta a otra base, por ejemplo Supabase. | Revisar `backend/.env.test`; las pruebas solo corren contra `localhost`. |
| E2E: `Port 3100 is already in use` o `Port 5180 …` | Quedó levantado un servidor de una corrida anterior. | Cerrar ese proceso; o, si es de una corrida E2E, Playwright lo reutiliza. |
| E2E: `Executable doesn't exist … chromium` | Falta descargar el navegador. | `npm run instalar-navegador` en `e2e/`. |

## 7. Agregar una prueba

| Si se agrega… | Va en… |
|---|---|
| Una regla en un service o entidad del backend | Unitaria al lado del archivo: `nombre.spec.ts`. |
| Algo que depende de la base (constraint, transacción, consulta) | Integración: `nombre.integration-spec.ts`. |
| Un endpoint nuevo | API: `backend/test/api/<módulo>/nombre.api-spec.ts`. |
| Un composable, servicio o pantalla del frontend | Unitaria al lado del archivo: `Nombre.spec.ts`. |
| Un requisito nuevo del TIF | Un recorrido E2E en `e2e/tests/`, con el código del requisito al principio del nombre. |

## 8. Integración continua

`.github/workflows/ci.yml` corre todo esto en GitHub Actions en cada push a `main` y en cada pull request, con los mismos
comandos de esta guía, en cinco jobs:

| Job | Qué corre |
|---|---|
| Backend · unitarias y cobertura | `npm run build`, `npm run typecheck:test` y `npm run test:cov` |
| Backend · integración y API | `npm run test:db:up`, `npm run test:db:migrate`, `npm run test:integration` y `npm run test:api` |
| Frontend · tipos, pruebas y build | `npm run type-check`, `npm run test:cov` y el build |
| E2E · Playwright | `npm test` en `e2e/`, después de que pasan los jobs de backend unitarias y frontend |
| Despliegue · docker compose | `docker compose up --build` y comprobación de que la web, el login y las 25 sedes responden |

El resultado se ve en la pestaña **Actions** del repositorio y junto a cada commit (✓ verde o ✗ roja). Si falla el job de
E2E, las capturas y trazas quedan como artefacto descargable (`e2e-resultados`) durante 7 días.
