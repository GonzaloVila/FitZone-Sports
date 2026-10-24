# LOG — FitZone Sports

> Bitácora del equipo (vinculada a los commits del repositorio).
> Formato disenado en el plan (Plan y Organizacion §5.2): cada integrante documenta por unidad
> sus **actividades**, **decisiones** y **problemas encontrados**, enlazando el registro a los commits.

**Regla de unicidad por unidad:** cada bloque corresponde a una historia del Sprint (SCRUM-xx).
**Regla de commits:** toda actividad cierra con link al commit/s del repo en GitHub.

---

## Unidad II — Frameworks (25%) · Exequiel Ansaldi (P2 — Backend Developer)

### Semana 3 · SCRUM-10 — Scaffolding, control de versiones, modelado de entidades y ORM

**Fecha:** 07–12/09/2026 · **Rama:** `main`

#### Tareas finalizadas (tablero Jira)

1. **Estructura base del backend (patrón por módulo) — Gonzalo (P4)**
   - Monorepo: el backend vive en `backend/` dentro de `FitZone-Sports`, con `commons/` (database, mediador, filters, guards) y `modules/` M1–M4 en capas (M5 hexagonal, pagos), más `prisma/`, `test/`, `.gitignore`, `.env.example` y `Dockerfile`.
   - El árbol completo se documentó en el **README** (m1 como modelo de referencia; m2–m4 replican el patrón, m5 hexagonal).
   - [commit 89b8c1d](https://github.com/GonzaloVila/FitZone-Sports/commit/89b8c1d) · [merge f7d7ad2](https://github.com/GonzaloVila/FitZone-Sports/commit/f7d7ad2) · [commit 03060bc](https://github.com/GonzaloVila/FitZone-Sports/commit/03060bc)

2. **Setup de repositorio Git y ramas de trabajo — Gonzalo (P4)**
   - `main` estable (release) + **una rama por developer** creada en GitHub: `santiago`, `exe`, `gonza`, `santino`. Sin `develop`: la integración entra por **PR a `main`** con revisión de ≥ 1 integrante.
   - El remoto ya tenía un `first commit` (README); se integró con `git merge --allow-unrelated-histories` (nunca `force push`), preservando ambas historias.

3. **Modelado de entidades (Usuario, Membresía, Cancha, Clase, Reserva, …) — Exequiel (P2)**
   - DBML **Opción B** (14 tablas / 20 refs) mapeado al `schema.prisma` completo: 14 modelos, enums de rol/plan/estados, herencia parte-todo en `Pago` (PK = FK 1:1, sin CHECK) e índices para RN-02 y RNF-03.
   - [commit 5916533](https://github.com/GonzaloVila/FitZone-Sports/commit/5916533)

4. **Configuración del ORM y conexión a PostgreSQL — Santino (P3), con apoyo de Exequiel y Gonzalo**
   - Entorno Node del backend (`package.json` / `package-lock.json`) + Prisma instalado, y `.env` desde `.env.example` con `DATABASE_URL` apuntando a la base PostgreSQL de Supabase (nunca committeado).
   - Migración `20260913000541_init` generada y aplicada: las **14 tablas** + el índice único parcial **RN-02** (`unq_reserva_turno` en `Reserva`, solo reservas no canceladas) y el índice de disponibilidad RNF-03.
   - [commit 5916533](https://github.com/GonzaloVila/FitZone-Sports/commit/5916533)

#### Decisiones tomadas

1. **Monorepo:** el backend vive en `backend/` dentro de `FitZone-Sports` (el repositorio del equipo), no en un repo separado. Coherente con el skeletón de la Fase C.
2. **Git con ramas personales:** `main` estable + una rama por developer creada en GitHub: `santiago`, `exe` (Exequiel), `gonza` (Gonzalo), `santino` (Santino). Sin `develop`: integración por PR a `main` (se crea `develop` si más adelante hace falta).
3. **El árbol se documenta (README), no se materializa con archivos vacíos:** los `.gitkeep` respetan la estructura y los `.ts` placeholder no se replican por módulo (ruido, sin valor compilable).

#### Pendiente (SCRUM-11b/c)

- Inyección de dependencias por constructor + providers de repositorios (interfaz + adaptador Prisma en M1–M4; puertos/adaptadores en M5).
- Primera API REST (CRUD básico) con Swagger en `/docs` y consolidación del entregable C4 + ADR de la Semana 2.

---

### Semana 4 · SCRUM-11b — Bootstrap NestJS

#### Actividades

1. **Repo NestJS + dependencias — Exequiel**
   - Repo NestJS creado en `backend/` con la instalación de dependencias (NestJS 12) y el bootstrap del server.
   - [commit 9ac889a](https://github.com/GonzaloVila/FitZone-Sports/commit/9ac889a)

2. **`Usuario.contrasenia` — Exequiel**
   - Columna `contrasenia` (hash obligatorio) agregada al modelo `Usuario` en DBML y Prisma; migración `usuario_contrasenia` aplicada en Supabase.
   - [commit c9efd4d](https://github.com/GonzaloVila/FitZone-Sports/commit/c9efd4d)

3. **`PrismaService` singleton (micro 2) — Exequiel**
   - `PrismaService` en `commons/database` (extiende `PrismaClient`; ping a Supabase al arranque con fails-fast; logs `$on('query')` vía `Logger` de Nest), expuesto por un `DatabaseModule` `@Global()`.
   - [commit d1d4642](https://github.com/GonzaloVila/FitZone-Sports/commit/d1d4642)

4. **Filtro global RFC 9457 (micro 3) — Santino guiado / Exequiel**
   - `ProblemException` + `ExceptionFilter` global en `commons/filters` respondiendo siempre `application/problem+json`: validación del `ValidationPipe` → 422 con `errors[]`, `BadRequestException` de parseo → 400, Prisma `P2002` (RN-02 `unq_reserva_turno` → 409 `turno-ocupado`, `idempotencia_key` → 409 `idempotencia-repetida`) y `P2025` → 404; el resto de `HttpException` → status + `about:blank` + `instance`, y no controlados → 500 (detalle solo en development). Registrado con `app.useGlobalFilters()` en `main.ts`.
   - [commit c5d49ec](https://github.com/GonzaloVila/FitZone-Sports/commit/c5d49ec)

5. **Mediador mínimo (micro 5) — Santiago Rayn**
   - `MediadorService` en `commons/mediador` que expone el **puerto de entrada de M5** (`ProcesarPagoPort`, ADR-01) para que M1/M4 lo inyecten **sin acoplar M5**: `solicitarCobro(solicitud)` delega en el port; inyectado con `@Optional()`, la app arranca hoy sin M5 y, cuando `PagosModule` provea `PROCESAR_PAGO_PORT`, el service lo resuelve solo (solo falta `imports: [PagosModule]` en `MediadorModule`).
   - El contrato (`SolicitudCobro` / `ComprobanteDto` / token `PROCESAR_PAGO_PORT` como string) vive en `commons/mediador/procesar-pago.port.ts` y se moverá a `m5-pagos` cuando se implemente el módulo, sin reescrituras (mismo criterio Design-First del Bloque 0).
   - `MediadorModule` (providers + exports) y `CommonsModule` real (imports/exports `MediadorModule`); `AppModule` y `UsuariosModule` lo importan → M1 queda habilitado a inyectar `MediadorService` sin conocer a los adaptadores de M5 ni a la pasarela.
   - Verificado: `npm run build` + `npx tsc --noEmit` en verde.
   - [commit a87744e](https://github.com/GonzaloVila/FitZone-Sports/commit/a87744e)

### Semana 4 · SCRUM-11c — Bloque 0: contrato de repositorios de M1 (Design-First)

#### Actividades

1. **Contrato de repositorios de M1 (Bloque 0) — Exequiel**
   - Siguiendo el reparto de Módulo 1 (lotes L1 y L4, SCRUM-11c) aprobado por el equipo, se acuerda primero la **interfaz del repositorio** (Design-First llevado a nivel de código): solo firmas + `InjectionToken`, sin lógica ni dependencia de Prisma. Es la referencia que replicarán M2–M4 (microtarea 4 del plan) y la que destraba los Bloques 1–3 para trabajar en paralelo.
   - `repositories/usuario.repository.ts` → `UsuarioRepository` (`crear`, `buscarPorId`, `buscarPorDniOEmail`, `actualizar`) + token `USUARIO_REPOSITORY`.
   - `repositories/socio.repository.ts` → `SocioRepository` (`crear`, `buscarPorId`, `actualizar`, `eliminar`) + token `SOCIO_REPOSITORY`.
   - `repositories/membresia.repository.ts` → `MembresiaRepository` (`crear`, `buscarPorSocioId`) + token `MEMBRESIA_REPOSITORY`.
   - Cada archivo co-ubica los tipos de dominio mínimos que sus firmas necesitan (espejo del contrato: `Rol[Alta]`, `PlanMembresia`, `EstadoMembresia`, etc.). Tokens de DI como **string**, sin `Symbol`; los Bloques 2 y 3 arrancan con mock del repositorio hasta que exista la implementación Prisma.
   - [commit 7fd6318](https://github.com/GonzaloVila/FitZone-Sports/commit/7fd6318)

---

### Semana 4 · SCRUM-11c — Bloque 1: Usuarios (L1)

#### Actividades

1. **CRUD de usuarios — Exequiel**
   - Implementado `UsuarioRepository` con Prisma (`repositories/prisma/prisma-usuario.repository.ts`) y las capas service/controller con DI por token string (`USUARIO_REPOSITORY` → `useClass`), reemplazando el placeholder `usuarios.module.ts` e importando `UsuariosModule` en `AppModule`.
   - Endpoints contra el contrato: `POST /usuarios` (201 + `Location`, `contrasenia` `writeOnly`; unicidad `dni`/`email` → 409; hash bcryptjs), `GET /usuarios/{id}` (200/404) y `PATCH /usuarios/{id}` (campos presentes, re-hash si cambia `contrasenia`); `UsuarioOutDto` con `@Exclude` garantiza que `contrasenia` nunca viaja en una respuesta.
   - Smoke verificado contra Supabase: 201 sin `contrasenia`, 409 `problem+json`, 404 de id inexistente, 200 con PATCH de `nombre` y de nueva contraseña.
   - [commit a73d15c](https://github.com/GonzaloVila/FitZone-Sports/commit/a73d15c)

2. **Entidades de dominio en `entities/` (refactor de Bloque 0/Bloque 1) — Exequiel**
   - Los tipos de dominio pasan de estar co-ubicados en los contratos a la capa `entities/` (`usuario.entity.ts`, `socio.entity.ts`, `membresia.entity.ts`), quedando los contratos de repositorio **puros** (solo firma + `InjectionToken`) e importando desde `../entities/…`, en línea con el README. El adaptador Prisma, service y DTOs actualizan sus imports; `npm run build` y smoke de regresión OK (404 y GET del usuario 1 sin `contrasenia`).
   - [commit 0891e9e](https://github.com/GonzaloVila/FitZone-Sports/commit/0891e9e)

---

### Semana 4 · SCRUM-11c — Bloque 2: preparación (Socios)

#### Decisiones

1. **`UsuarioActualizable.rol` para la transición `SOCIO↔EXTERNO` — Exequiel**
   - `UsuarioActualizable` incorpora `rol?: RolUsuario` para que el Bloque 2 mute el rol en el alta/baja (→ `SOCIO` en `POST /socios`, → `EXTERNO` en `DELETE /socios`). El cambio se aplica **dentro de la transacción atómica del adaptador Prisma de Socios** (`prisma-socio.repository.ts`): como el contrato de repositorio no es transaccional, la escritura del rol se hace con el mismo `tx`, no vía el puerto `UsuarioRepository.actualizar` (que opera fuera de la transacción). El `rol` sigue vedado en el `PATCH /usuarios` (`ModificarUsuarioDto` no lo incluye).
   - [commit 85b9b03](https://github.com/GonzaloVila/FitZone-Sports/commit/85b9b03)

---

### Semana 4 · SCRUM-11c — Bloque 2: Socios (parte de L4)

#### Actividades

1. **CRUD de socios — Santino**
   - Implementado `SocioRepository` con Prisma (`repositories/prisma/prisma-socio.repository.ts`) y las capas service/controller con DI por token string (`SOCIO_REPOSITORY` → `useClass`), agregando `SociosController` y `SociosService` a `usuarios.module.ts`.
   - Endpoints contra el contrato: `POST /socios` (201 + `Location`; si se envía `plan`, crea Socio + Membresía en la misma transacción; actualiza el rol del usuario a `SOCIO`), `GET /socios/{socioId}` (200/404), `PATCH /socios/{socioId}` (actualiza `sede_origen_id`) y `DELETE /socios/{socioId}` (elimina Socio + Membresía 1:1 y devuelve el usuario a rol `EXTERNO`; preserva historial de pagos/reservas).
   - Mapeo dominio↔esquema: el contrato y `socio.entity.ts` usan `sede_origen_id`, mientras que la columna real en `schema.prisma` es `sede_id`; el mapeo queda resuelto en el adaptador Prisma (`crear`, `actualizar`, `aDominio`), sin tocar el contrato ni el service.
   - Extraído `calcularVigencia` a un util compartido (`repositories/prisma/membresia.util.ts`) para que el Bloque 3 (Membresías) lo reutilice sin duplicar el cálculo de `fecha_fin` por plan.
   - `npm run build` verificado en verde (exit code 0).
   - [commit fe5d9a7](https://github.com/GonzaloVila/FitZone-Sports/commit/fe5d9a7)

2. **Atomicidad del cambio de rol (fix Bloque 1/Bloque 2) — Exequiel**
   - El rol se movió **dentro de la transacción del adaptador** (`prisma-socio.repository.ts`): `crear` hace `tx.usuario.update({ rol: 'SOCIO' })` junto al socio+membresía, y `eliminar` hace `tx.usuario.update({ rol: 'EXTERNO' })` tras borrar la membresía 1:1 y la fila Socio. Se eliminaron las llamadas a `usuarios.actualizar({ rol })` del service (los pre-chequeos 404/409 quedan vía `UsuarioRepository`). Motivo: el contrato no es transaccional, así que "rol vía el puerto dentro de la transacción" no era implementable sin romper el B0; la escritura con el mismo `tx` garantiza que no quede un socio sin rol (o rol sin socio).
   - [commit ef6e817](https://github.com/GonzaloVila/FitZone-Sports/commit/ef6e817)

3. **FK inexistente (P2003) → 422 + seed de Sede + smoke de `/socios` — Exequiel**
   - `problem.filter.ts` mapea ahora `P2003` (referencia foránea inexistente) a **422** `application/problem+json` (`Referencia inexistente`), junto a los casos P2002/P2025. Sin esto, `sede_origen_id` inexistente devolvía 500 aunque la spec pide 422.
   - Se insertó la primera fila en `Sede` (id 1, `Sede Central`) en Supabase: la tabla estaba vacía, por lo que ningún `POST /socios` podía completarse.
   - Smoke completo verde contra Supabase: POST 201 + `Location` (+ verifico `rol:SOCIO` en la transacción), POST repetido 409, POST usuario inexistente 404, POST/PATCH con sede inexistente **422**, GET 200/404, PATCH 200, DELETE 204 (+ `rol:EXTERNO` y membresía 1:1 eliminada, GET post-DELETE 404). Regresión de usuarios OK (409 dni repetido, 422 whitelist sin `rol`). Base limpia al final (0 socios / 0 membresías).
   - [commit 1b3744e](https://github.com/GonzaloVila/FitZone-Sports/commit/1b3744e)

4. **`calcularVigencia` a la capa de dominio — Exequiel**
   - La regla que calcula `fecha_fin` por plan se movió de `repositories/prisma/membresia.util.ts` (infra) a `entities/membresia.entity.ts` (dominio, junto a la entidad `Membresia`). El adaptador de Socios ahora la importa desde `../../entities/membresia.entity`; la capa de infraestructura no es lugar para reglas de negocio puras. Se normalizaron las comillas del entity al estilo del repo.
   - Verificado: build OK + smoke (POST /socios con `plan:MENSUAL` → `fecha_fin` = +1 mes, 20/09 → 20/10); base limpia al final.
   - [commit 6a1372a](https://github.com/GonzaloVila/FitZone-Sports/commit/6a1372a)

5. **DTOs strict-clean (definite-assignment `!`) - Exequiel**
   - Los campos **no opcionales** de las DTOs de M1 llevan ahora asignación definitiva (`!`): `CrearUsuarioDto` (`rol`, `dni`, `nombre`, `email`, `contrasenia`), `CrearSocioDto` (`usuario_id`, `sede_origen_id`), `UsuarioOutDto` (`id`, `rol`, `dni`, `nombre`, `email`) y `SocioOutDto` (`id`, `usuario_id`, `sede_origen_id`, `fecha_alta`). Los `?` (`plan`, `telefono`, `foto_url`, …) quedan igual.
   - El motivo: quedan compilables bajo `strictPropertyInitialization` (el editor de TS 6 lo aplica aunque el tsconfig del proyecto no tenga `strict`); en runtime no cambia nada, el `ValidationPipe`/`plainToInstance` asigna los campos al validar. Verificación: `npm run build` + `npx tsc --noEmit` en verde.
   - [commit 95629dc](https://github.com/GonzaloVila/FitZone-Sports/commit/95629dc)

---

### Semana 4 · SCRUM-11c — Bloque 3: Membresías (resto de L4) · Santiago Rayn

#### Actividades

1. **CRUD y ciclo de vida de membresías — Santiago Rayn**
   - Implementado `MembresiaRepository` con Prisma (`repositories/prisma/prisma-membresia.repository.ts`) para operaciones de persistencia (`crear` y `buscarPorSocioId`), aplicando la regla de negocio de cálculo de vigencia (`calcularVigencia` desde `entities/membresia.entity.ts`) según el plan (`MENSUAL` +1 mes, `TRIMESTRAL` +3 meses, `ANUAL` +1 año) y respetando la fecha de inicio (`fecha_inicio` indicada o por defecto la fecha actual).
   - Capa de aplicación en `services/membresias.service.ts` con inyección de dependencias desacoplada mediante tokens string (`MEMBRESIA_REPOSITORY` y `SOCIO_REPOSITORY`):
     - `POST /socios/{socioId}/membresias`: valida existencia del socio (404 si no existe), regla 1:1 socio↔membresía (409 si el socio ya tiene membresía activa) y retorna 201 Created con cabecera `Location: /api/v1/socios/{socioId}/membresias`.
     - `GET /socios/{socioId}/membresias`: verifica que el socio exista (404 si no existe) y devuelve su membresía vigente (200 con `MembresiaOutDto`, o 404 si no posee membresía).
   - Controlador HTTP en `controllers/membresias.controller.ts` con decoradores OpenAPI/Swagger bajo el tag `M1 Membresías`, validación de parámetro de ruta entero con `ParseIntPipe`, y manejo de respuestas HTTP tipadas (200, 201, 400, 404, 409, 422).
   - DTOs tipados estrictos con asignación definitiva (`!`): `CrearMembresiaDto` (`dtos/crear-membresia.dto.ts`) validando enum de planes con `class-validator`, y `MembresiaOutDto` (`dtos/membresia-out.dto.ts`) con serialización segura vía `class-transformer` (`@Exclude()` / `@Expose()`).
   - Registrado en `UsuariosModule` (`usuarios.module.ts`) proveyendo `MembresiasController`, `MembresiasService` y `{ provide: MEMBRESIA_REPOSITORY, useClass: PrismaMembresiaRepository }`, y agregado del tag `M1 Membresías` a la configuración de Swagger en `main.ts`.
   - Validación integral: `npm run build` y `npx tsc --noEmit` en verde sin errores. Suite de smoke test ejecutada exitosamente contra Supabase cubriendo todos los casos de borde (socio inexistente 404, socio sin membresía 404, plan inválido 422, alta con cálculo de fechas 201, lectura 200, duplicado 409, parámetro inválido 400, y borrado 204), dejando la base de datos íntegra y limpia al finalizar.
   - [commit 77e707e](https://github.com/GonzaloVila/FitZone-Sports/commit/77e707e)

2. **PATCH `modificarMembresia` + alineación del contrato en DTOs — Exequiel**
   - Completa el CRUD de membresías que el contrato (YAML) define: se agrega `PATCH /socios/{socioId}/membresias` (`operationId modificarMembresia`). El caso de uso es el **cambio sobre la misma fila** (relación 1:1 sin historial): `MembresiaRepository` gana `actualizar(socioId, cambios)`, con `MembresiaActualizable` (`plan?`, `renueva_automatica?`, `estado?`) en `entities/membresia.entity.ts`. Si viene `plan`, el adaptador **recalcula `fecha_fin` desde la fecha actual** reusando `calcularVigencia` (regla de dominio, Decisión 3 del Bloque 2); si el PATCH toca solo estado/renovación, la `fecha_fin` queda intacta. `MembresiaPatchDto` nuevo (todo opcional); el service hace los pre-chequeos (socio inexistente → 404, socio sin membresía → 404).
   - Alineación contract-first en DTOs: se **saca `socio_id` de `CrearMembresiaDto`** (el contrato `MembresiaIn` es `additionalProperties:false` y el service usaba el id de la ruta; ahora enviarlo en el body da 422 por `forbidNonWhitelisted`) y **se saca `@Expose()` de `socio_id` en `MembresiaOutDto`** (el `MembresiaOut` del YAML no lo lleva). 
   - Verificado: build + `npx tsc --noEmit` en verde + smoke contra Supabase (PATCH plan MENSUAL→TRIMESTRAL 200 con `plan` persistido y `fecha_fin` +91 días desde hoy con `fecha_inicio` intacta, PATCH `estado:SUSPENDIDA` 200 conservando `fecha_fin`, PATCH `renueva_automatica:true` 200, PATCH a socio sin membresía 404, socio inexistente 404, plan inválido 422, POST con `socio_id` en body 422, GET sin `socio_id` en la respuesta). Base limpia al final (0 socios / 0 membresías; usuario de prueba eliminado; usuario 1 → `EXTERNO`).
   - [commit c8042e6](https://github.com/GonzaloVila/FitZone-Sports/commit/c8042e6)

---

### Semana 4 · SCRUM-11c — Bloque 4 : infraestructura de testing e2e de M1 · Gonzalo

#### Actividades

1. **Aislamiento de la base de datos de test — Gonzalo**
   - El equipo usa Supabase free tier (2 proyectos gratis por organización, sin margen para duplicar la base de desarrollo). Se descartó un segundo proyecto Supabase y un schema separado dentro del mismo proyecto compartido, y se optó por un Postgres efímero en Docker (`docker-compose.test.yml`, puerto `5432`) exclusivo para los tests e2e, sin tocar la Supabase de desarrollo del equipo. **Fix 2026-10-03:** el mapeo original era `55432:5432` pero `.env.test` apunta a `127.0.0.1:5432`; se unificó el puerto a `5432` para que funcione out-of-the-box.
   - [commit 398a1c5](https://github.com/GonzaloVila/FitZone-Sports/commit/398a1c5)

2. 2. **Test runner: Vitest — Gonzalo**
   - Se eligió Vitest como test runner para el backend (Nest 12.x), coherente con el resto del stack: el frontend del proyecto ya es Vue + Vite, y Vitest —hecho por el mismo equipo de Vite— permite un único test runner para todo el proyecto en vez de dos herramientas distintas para backend y frontend.
   - Agregado `backend/.swcrc` (con `decoratorMetadata: true`) y `unplugin-swc` en `vitest.e2e.config.ts`: Vitest usa `esbuild` por default, que no emite la metadata de decoradores que la inyección de dependencias de Nest necesita: sin esto el `TestingModule` no resuelve los providers.
   - `backend/test/vitest.e2e.setup.ts` carga `.env.test` (variables del contenedor Docker) antes de instanciar cualquier módulo de Nest, para que los tests nunca puedan apuntar por error a la Supabase compartida.
   - Agregado `postinstall: "prisma generate"` en `package.json` para que el cliente de Prisma se regenere solo después de cualquier `npm install` (evita un cliente desalineado en la máquina de cualquier integrante).
   - `@vitest/coverage-v8` instalado junto con el resto: la Unidad V del TFI pide explícitamente "reporte de cobertura" como entregable ponderado (15%), y queda resuelto de una.
   - [commit 398a1c5](https://github.com/GonzaloVila/FitZone-Sports/commit/398a1c5)

3. **Test e2e del flujo completo de M1 — Gonzalo**
   - `test/m1.e2e-spec.ts`: flujo `POST /usuarios` → `POST /socios` (con plan, verificando transacción socio+membresía y cambio de rol a `SOCIO`) → `GET /socios/{socioId}/membresias` (verificando `fecha_fin` calculada) → `DELETE /socios/{socioId}` (verificando 204, rol de vuelta a `EXTERNO` y membresía eliminada). Casos negativos cubiertos: usuario inexistente (404), usuario ya socio (409), socio con membresía duplicada (409).
   - Como M1 no expone un endpoint propio para crear `Sede` (corresponde a M2, todavía no implementado), la `Sede` necesaria para `sede_origen_id` se inserta directo con Prisma en el `beforeAll` del test, no vía HTTP.
   - Import de `supertest` ajustado a `import request from 'supertest'` (en vez de `import * as request`): el interop de módulos CommonJS de Vite/Vitest expone el default distinto al de `ts-jest`.
   - Verificado: `npm run test:e2e` en verde (4/4 tests).
   - [commit 398a1c5](https://github.com/GonzaloVila/FitZone-Sports/commit/398a1c5)

#### Decisiones

1. **Docker en vez de un segundo proyecto Supabase:** con el equipo en el plan free de Supabase, aislar los tests con un Postgres local en Docker no consume el límite de proyectos gratis del equipo y es la misma pieza que se va a necesitar para el pipeline de CI/CD de la Unidad V (Semana 12) — se resuelve una sola vez para las dos cosas.
2. **Vitest como test runner del proyecto:** un solo runner para backend y frontend (coherente con Vue + Vite), en vez de dos herramientas de testing distintas según el módulo.

#### Actividades

1. **Auditoría de Swagger consolidada en `/docs` (cierre de Bloque 4) — Exequiel**
   - Se cierra el pendiente del Bloque 4 con la auditoría del Swagger de M1 (los 10 endpoints, no 9: `POST /socios/{socioId}/membresias` suma un `@ApiParam` propio). Se creó `commons/swagger/problem-details.dto.ts` (`ProblemDetailsDto`, RFC 9457: `type/title/status/detail/instance/errors`) y `commons/swagger/problem-json.ts` (`PROBLEM_JSON`, media type `application/problem+json` apuntando por `$ref` al DTO compartido).
   - En `usuarios.controller.ts`, `socios.controller.ts` y `membresias.controller.ts`: todas las respuestas 400/404/409/422 ahora llevan `content: PROBLEM_JSON` (antes documentaban `application/json` vacío o sin schema), los 201 ganaron la cabecera `Location` con ejemplo numérico (`/api/v1/usuarios/1`, `/api/v1/socios/2`, `/api/v1/socios/2/membresias`) y todos los `@ApiParam` de ruta (`id`, `socioId`) llevan `example` numérico (usuario 1, socio 2). Se agregó `@ApiExtraModels(ProblemDetailsDto)` por controller para que el schema quede registrado en `components.schemas` aunque se referencie por `$ref`.
   - Ejemplos numéricos completados en DTOs: `UsuarioOutDto.id: 1`, `SocioOutDto.{id: 2, usuario_id: 1, sede_origen_id: 3}`, `CrearSocioDto.{usuario_id: 1, sede_origen_id: 3}`, `ModificarSocioDto.sede_origen_id: 3`.
   - Verificado: `npx tsc --noEmit` + `npm run build` en verde, y `/docs-json` real (app levantada en `:3199`) confirmó `application/problem+json` → `$ref ProblemDetailsDto`, `Location` ejemplificadas y `ProblemDetailsDto` en `components.schemas` con las 6 propiedades.
   - [commit 3b2107d](https://github.com/GonzaloVila/FitZone-Sports/commit/3b2107d)

2. **Extensión del contrato OpenAPI para M2 (Ingresos/Aforo) y M3 (Lista de espera) — Exequiel**
   - Antes de programar M2 y M3 se extiende el contrato en `TFI FitZone - OpenAPI.yaml` (Design-First, sigue la nota «Por qué hay que extender el contrato» del 24/09): el YAML ya es la fuente de los tipos del frontend (`schema.d.ts`) y de la documentación de `/docs`.
   - **M2 (RF-04/RF-05):** `POST /ingresos` (`registrarIngreso`: body `IngresoIn` con `qr_token` —revisable hasta definir el QR en Unidad III— y `fecha_hora_ingreso` opcional por RNF-01 offline; respuestas 201+`Location`, 403 `MembresiaInactiva`, 404, 409 `ConflictoAcceso` con los casos `acceso-duplicado` (RN-01) y `aforo-lleno` (RF-05), 422), `POST /ingresos/{ingresoId}/egreso` (`registrarEgreso`, 204/404/409 `EgresoDuplicado`) y `GET /sedes/{sedeId}/aforo` (`obtenerAforo`, 200 `AforoOut {aforo_actual, aforo_maximo, restante}`/404).
   - **M3 (RF-08):** `POST /clases/{claseId}/espera` (`anotarseEnEspera`, 201+`Location`, 404, 409 `ConflictoEspera` con `espera-existente`/`cupo-disponible`, 422), `GET/DELETE /esperas-clases/{esperaId}` (`obtenerEspera` / `salirDeEspera` con **baja lógica** → `EstadoEspera.CANCELADO`, 204/404/409 `EsperaConfirmada`) y `POST /esperas-clases/{esperaId}/confirmacion` (`confirmarEspera`, first-come: 204 creando la `ReservaClase`, 404, 409 `ConfirmacionRechazada` con `no-notificada`/`cupo-tomado`).
   - Componentes nuevos: parámetros `ClaseId`/`IngresoId`/`EsperaId`, schemas `IngresoIn/Out`, `AforoOut`, `EsperaIn/Out`, `EstadoEspera`, y 6 responses problem+json reutilizables. El YAML sigue siendo OpenAPI 3.0.3; el mismo estilo (`nullable: true`, `examples` mapeados para 409 de doble causa).
   - Validado estructuralmente: parseo YAML + resolución de todos los `$ref` (26 paths, 39 schemas, 13 parámetros, 19 respuestas, ninguna referencia rota).
   - El YAML vive en el vault de Obsidian (fuera del repo), por eso no hay commit de este punto.

#### Pendiente (cierre de Bloque 4)

- ~~Auditoría de Swagger consolidado en `/docs`: tags, ejemplos con ids numéricos y códigos 404/409/422 completos en los 9 endpoints de M1.~~ Hecho: 10 endpoints, problem+json compartido, `Location` y ejemplos numéricos.
- Los tests e2e de M1 (`npm run test:e2e`) no se releejaron en esta pasada (requiere levantar el Postgres de `docker-compose.test.yml`); el cambio de la auditoría es solo de decoradores OpenAPI — sin afectar el comportamiento HTTP verificado en el bloque de testing.

---

## Unidad II — Módulo 2: Gimnasio y Acceso (RF-04/RF-05) · Gonzalo + Santiago

### Semana 5 · SCRUM-11c — Bloque 0 a 4: implementación completa de M2

Sigue `Plan_de_Trabajo_M2_FitZone.md` (5 bloques). Se deja explícitamente **fuera de alcance** (pendiente de definir con la cátedra): el mecanismo de QR dinámico y dónde persistir su secreto/credencial. `qr_token` queda como campo opaco: se exige presente en `IngresoIn`, no se valida criptográficamente ni se persiste ninguna credencial nueva.

#### Actividades

1. **Bloque 0 — Coordinación con M1: vigencia real de membresía**
   - `estaVigente(m, ahora)` agregada a `entities/membresia.entity.ts` (junto a `calcularVigencia`): `estado !== 'SUSPENDIDA' && fecha_fin >= ahora`. Necesaria porque M1 nunca transiciona `estado` de `ACTIVA` a `VENCIDA` por sí solo — confiar solo en `estado` dejaría pasar a un socio vencido hasta la próxima corrida del cron.
   - `MembresiasCron` (`m1-usuarios/crons/membresias.cron.ts`, `@nestjs/schedule`, `EVERY_DAY_AT_MIDNIGHT`) llama a `MembresiaRepository.marcarVencidas()` (nuevo método, `updateMany` de `ACTIVA` con `fecha_fin` pasada → `VENCIDA`). Registrado en `usuarios.module.ts` junto a `ScheduleModule.forRoot()`.
   - `Ingreso.validado_offline` (boolean, default `false`) agregado a `schema.prisma` y `docs/db/fitzone.dbml` (RNF-01: auditoría online/offline). Migración `20260925000000_ingreso_validado_offline` generada; **pendiente de aplicar en Supabase** (`npx prisma migrate deploy`, ver nota abajo).
   - [commit e46d0dd](https://github.com/GonzaloVila/FitZone-Sports/commit/e46d0dd)

2. **Puente M1 → M2: `MembershipValidationPort`**
   - Puerto nuevo en `commons/membresia/membership-validation.port.ts` (`consultarVigencia(usuarioId) → { vigente }`), mismo patrón que `ProcesarPagoPort`/`MediadorService` (ADR-01). Adaptador real `MembresiaValidationAdapter` en `m1-usuarios/adapters/`, que resuelve `Socio` → `Membresia` → `estaVigente`.
   - `SocioRepository` gana `buscarPorUsuarioId(usuarioId)` (interfaz + adaptador Prisma) para que el adaptador pueda ubicar al socio a partir del `usuario_id` que llega en `IngresoIn`.
   - `UsuariosModule` provee y **exporta** `MEMBERSHIP_VALIDATION_PORT`; `GimnasioModule` importa `UsuariosModule` solo para ver ese token — el código de M2 nunca importa `SOCIO_REPOSITORY` ni `MEMBRESIA_REPOSITORY` de M1 directamente (aislamiento entre módulos, ADR-07).
   - [commit e46d0dd](https://github.com/GonzaloVila/FitZone-Sports/commit/e46d0dd)

3. **Bloque 1/2/3 — Sede, Ingresos, Egreso y Aforo**
   - Estructura idéntica a `m1-usuarios` (entity → repository interfaz+token → adaptador Prisma → service → controller Swagger): `GET/POST /sedes`, `GET /sedes/{sedeId}/aforo`, `POST /ingresos`, `POST /ingresos/{ingresoId}/egreso`.
   - Aforo sigue siendo `COUNT` derivado (sin columna contador). `PrismaIngresoRepository.crear` hace `SELECT aforo_maximo FROM "Sede" ... FOR UPDATE` + `count` + `insert` dentro de un mismo `$transaction` (lock pesimista de fila, evita inventar un contador con versión u optimistic locking).
   - Errores de negocio (`membresia-inactiva` 403, `acceso-duplicado`/`aforo-lleno` 409, `egreso-duplicado` 409) lanzados con `ProblemException` directo (no dependen de mapear constraints de Prisma en `ProblemFilter`, porque no son violaciones de esquema sino reglas de dominio).
   - [commit e46d0dd](https://github.com/GonzaloVila/FitZone-Sports/commit/e46d0dd)

4. **Bloque 4 — QA e integración**
   - `npx tsc --noEmit` y `npm run build` en verde.
   - `test/m2.e2e-spec.ts` (mismo patrón Vitest+supertest que `m1.e2e-spec.ts`): alta de sede, flujo ingreso→aforo→egreso, RN-01 (409 acceso-duplicado), egreso duplicado (409), aforo lleno con `aforo_maximo:1` (409), membresía vencida (403), sede/ingreso inexistente (404). No corrido en este entorno por falta de Docker levantado; pendiente correrlo con `docker compose -f docker-compose.test.yml up -d && npm run test:e2e`.
   - `@nestjs/schedule` agregado a `package.json` (`^12.0.2`, la única serie compatible con la versión de Nest 12.x ya instalada en el repo).
   - [commit e46d0dd](https://github.com/GonzaloVila/FitZone-Sports/commit/e46d0dd)

#### Decisiones

1. **CRUD de Sede sí entra en M2:** `Plan_de_Trabajo_M2_FitZone.md` (Bloque 1) y `TFI FitZone - OpenAPI.yaml` (tag `sedes`, paths `GET/POST /sedes`) lo definen como parte del módulo, así que se implementó como CRUD completo (alta + listado).
2. **Migración de `validado_offline` no aplicada todavía:** se generó el SQL pero no se ejecutó contra la Supabase compartida del equipo — requiere que alguien con acceso la corra a propósito (`npx prisma migrate deploy` desde `backend/`).
3. **Contrato OpenAPI (vault de Obsidian) pendiente de sincronizar:** falta agregar `validado_offline` a `IngresoIn`/`IngresoOut` en el YAML real. El código y `fitzone.dbml` ya lo reflejan.

---

### Semana 5 · SCRUM-11c - cierre de M2: auditoría de contrato, RN-01 atómico y aislamiento de módulos

Auditoría de M2 contra el plan de trabajo, el OpenAPI del vault y la arquitectura ya documentada. Salieron cinco correcciones de código, todas verificadas con `tsc --noEmit`, `npm run build` y pruebas reales de resolución de DI.

#### Actividades

1. **RN-01 pasa a ser atómica en la base, no solo en el service**
   - El chequeo previo de acceso duplicado corre **fuera** de la transacción de `crear()`, así que dos accesos simultáneos (doble toque, reintento por timeout, o el lote de sincronización offline de RNF-01) podían pasar los dos antes de que ninguno hubiera insertado.
   - Migración `20260925010000_ingreso_usuario_abierto_unq`: índice único parcial sobre `(usuario_id) WHERE fecha_hora_egreso IS NULL`. Al hacer el `UPDATE` del egreso la fila sale del índice y el usuario vuelve a poder ingresar.
   - Va como SQL a mano porque Prisma 6.19.3 no modela índices parciales: requiere el preview feature `partialIndexes`, que no existe en esta versión.
   - `ResultadoCrearIngreso` suma el motivo `ACCESO_DUPLICADO`; `PrismaIngresoRepository.crear()` traduce `P2002` a ese motivo en vez de dejarlo explotar como 500; `IngresosService` comparte la misma `problem+json` entre el atajo previo y el camino que vuelve del índice, para que los dos emitan respuesta idéntica.
   - **Aplicada en la Supabase compartida**: `prisma migrate status` al día y `migrate diff` sin drift.
   - [commit f76b396](https://github.com/GonzaloVila/FitZone-Sports/commit/f76b396)

2. **Tags de Swagger alineados con el contrato**
   - Los controladores declaraban los tags en PascalCase (`Usuarios`, `Socios`, `Membresias`, `Sedes`, `Ingresos`) mientras el YAML del vault los define en minúscula. El contrato manda sobre el código.
   - Verificado: las 14 operaciones quedan agrupadas en sus 5 tags y ninguna queda sin tag.
   - [commit 347650d](https://github.com/GonzaloVila/FitZone-Sports/commit/347650d)

3. **Aislamiento real entre módulos de dominio (arquitectura, no estilo)**
   - `GimnasioModule` importaba `UsuariosModule` solo para ver `MEMBERSHIP_VALIDATION_PORT`. Eso viola la regla de que los módulos de dominio no se importen entre sí (`Diagramas C4.md:228`, ADR-07), y el patrón no iba a poder repetirse en M5, donde `ModuloPagos` tiene que publicarse sin que M1 ni M4 lo importen (`Unidad II - Backend.md:134`).
   - `UsuariosModule` pasa a `@Global()` y su array `exports` queda como filtro: sale únicamente `MEMBERSHIP_VALIDATION_PORT`. Los repositorios y services de M1 siguen privados, comprobado con un módulo ajeno que intenta inyectarlos y falla el DI en los tres casos.
   - Comportamiento observable sin cambios: `IngresosService` sigue recibiendo `MembresiaValidationAdapter` en su `@Optional()`.
   - La regla quedó documentada en el plan M2 (decisión 4 y dependencia del Bloque 0) y replicada en el plan M3, que ahora referencia la interfaz real `MembershipValidationPort` en lugar del nombre tentativo `ConsultaMembresiaPort`.
   - [commit 425991f](https://github.com/GonzaloVila/FitZone-Sports/commit/425991f)

4. **`fecha_hora_egreso` tipada como `string/date-time`**
   - `@ApiPropertyOptional` sobre `Date | null` no es inferible por Nest, así que publicaba `type: object`, que no valida un date-time y contradecía el contrato del vault. Se declaran `type` y `format` explícitos. Es el único `Date | null` del proyecto.
   - [commit 1e73eca](https://github.com/GonzaloVila/FitZone-Sports/commit/1e73eca)

5. **`package-lock.json` desincronizado (rompía `npm ci`)**
   - Faltaban las 27 entradas de binarios opcionales por plataforma de vite 8 (`rolldown` 1.2.9, `lightningcss` 1.33.0, `fsevents` 2.3.3), todas dev-only. `npm ci` fallaba con EUSAGE y 27 errores `Missing ... from lock file`: clonar el repo e instalar era imposible.
   - Sin cambios de versión en dependencias existentes. `npm ci --dry-run` queda en exit 0.
   - [commit f3b8faf](https://github.com/GonzaloVila/FitZone-Sports/commit/f3b8faf)

6. **Sincronización con el vault (fuera de este repositorio)**
   - `TFI FitZone - OpenAPI.yaml`: `validado_offline` agregado a `IngresoIn` (opcional) y a `IngresoOut` (`required`, `properties` y `example`). En `IngresoIn` no era cosmético: declara `additionalProperties: false`, así que un request que mandara el campo era rechazado por cualquier validador estricto mientras el DTO lo aceptaba.

#### Pendientes de la entrada anterior, resueltos en esta

1. **Migración de `validado_offline`: aplicada** en la Supabase compartida, junto con la nueva del índice de RN-01. Base al día y sin drift.
2. **Contrato OpenAPI: sincronizado.** `validado_offline` ya está en `IngresoIn` e `IngresoOut` del YAML real.
3. **Import entre módulos de dominio: eliminado**, según la actividad 3.

#### Pendientes que siguen abiertos
1. **Prueba funcional del índice de RN-01** contra la base real: requiere escribir datos de prueba en la Supabase compartida, así que no se hizo sin autorización explícita.
2. **QR/TOTP**: sigue diferido a Unidad III, pendiente de definir con la cátedra el mecanismo del QR dinámico y dónde persistir su secreto.
3. **Nombres de schema del contrato**: el YAML define `IngresoIn`/`IngresoOut` y Nest genera `IngresoInDto`/`IngresoOutDto`. Diferencia cosmética, se difiere.

---

## Unidad II — Módulo 4: Canchas Deportivas (RF-09/RF-12) · Santino + Exequiel

### Semana 6 · SCRUM-11c — Bloque 0: coordinación con M1/M2 y migración de concurrencia

#### Actividades

1. **Puerto de sede (`SEDE_VALIDATION_PORT`)**
   - Puerto nuevo en `commons/sede/sede-validation.port.ts` (`existeSede(sedeId) → boolean`), mismo patrón que `MembershipValidationPort`/`MediadorService` (ADR-01). Adaptador real `SedeValidationAdapter` en `m2-gimnasio/adapters/`, resuelve contra `SEDE_REPOSITORY`.
   - `GimnasioModule` pasa a `@Global()` y **exporta únicamente** `SEDE_VALIDATION_PORT` — `SEDE_REPOSITORY`, `INGRESO_REPOSITORY` y los services de M2 siguen privados (aislamiento entre módulos, ADR-07). M4 va a consumir el puerto sin importar `GimnasioModule` completo.

2. **Migración: constraint de exclusión reemplaza al unique parcial (RN-02/RF-10)**
   - `unq_reserva_turno` (unique parcial sobre `cancha_id, fecha_hora_inicio`) solo detectaba colisión exacta de inicio y dejaba pasar solapamientos (ej. 18:00–19:30 con 18:30–19:30). Reemplazado por `exq_reserva_turno`: `EXCLUDE USING gist` sobre `(cancha_id WITH =, tsrange(fecha_hora_inicio, fecha_hora_fin) WITH &&) WHERE estado <> 'CANCELADA'`, requiere `CREATE EXTENSION btree_gist`.
   - `tsrange` y no `tstzrange` a propósito: las columnas son `TIMESTAMP(3)` sin zona; con `tstzrange` Postgres castearía según el `TimeZone` de cada sesión y la constraint dependería de quién escribe.
   - Migración a mano (`20260925020000_reserva_solapamiento_exclude`): Prisma no modela `EXCLUDE` ni índices parciales.
   - **Hallazgo verificado empíricamente**: a diferencia de `P2002`/`P2003` (que Prisma tipa como `PrismaClientKnownRequestError` con `.code`), la violación de una constraint de exclusión llega como `PrismaClientUnknownRequestError` con `.code` en `undefined` — el código Postgres real (`23P01 exclusion_violation`) solo aparece embebido en el mensaje. El `catch` del Bloque 3 no puede replicar el patrón `error.code === 'P2002'` de M2; necesita chequear `error instanceof Prisma.PrismaClientUnknownRequestError` + matchear el nombre de la constraint en el mensaje.
   - `npx prisma migrate status` confirmado sin drift tras aplicar.

3. **Nota de entorno (Windows, no bloqueante)**
   - `core.autocrlf=true` local convirtió LF→CRLF en una migración ya aplicada, lo que casi dispara un reset completo de la Supabase compartida al correr `prisma migrate dev`. Se evitó a tiempo; se aplicó con `prisma migrate deploy` en su lugar. Se agrega `.gitattributes` (`*.sql text eol=lf`) para que no le pase a nadie más.

   - [commit ad306b9](https://github.com/GonzaloVila/FitZone-Sports/commit/ad306b9)

---

## Unidad II — Consistencia de contrato, base de datos y listados · Gonzalo

### Semana 6 · SCRUM-11c — cierre de consistencia de M1/M2 y listados de M1

El contrato del vault, `schema.prisma`, el DBML y la base compartida habían quedado con la nomenclatura de datos en `snake_case` pero la base todavía conservaba nombres cortos en dos columnas. Además el código no había alcanzado dos cosas que el contrato ya declaraba. Esta entrada cierra esa brecha y agrega los listados de M1.

**Respaldo previo:** `pg_dump -Fc` de la Supabase compartida en `_backups/supabase-pre-fase1-20260927-205514.dump` (320,85 KB, 552 entradas, con datos de las 14 tablas), verificado con `pg_restore -l` antes de tocar nada.

#### Actividades

1. **`Socio.sede_id` → `sede_origen_id`**
   - El dominio y la API ya usaban el nombre largo; la columna era la última capa con el corto. El nombre largo distingue la sede de alta de las sedes a las que el socio accede.
   - Migración `20260927000000_socio_sede_origen_id`, con su FK. **Aplicada en la Supabase compartida** con `migrate deploy` (nunca `migrate dev`: Prisma 6.19.3 no modela `exq_reserva_turno` ni el índice parcial de RN-01, y los borraría).
   - [commit e11c9c8](https://github.com/GonzaloVila/FitZone-Sports/commit/e11c9c8)

2. **`Pago.fecha_pago`**
   - El contrato la declara `required` y no había forma de obtenerla de la fila. `timestamp(3) not null default now`.
   - Migración `20260927000100_pago_fecha_pago`, **aplicada en la Supabase compartida**.
   - Las 3 filas de `Pago` que ya existían quedaron con la fecha de la migración, no su fecha real de cobro. Se aceptó así por ser datos de prueba.
   - [commit e11c9c8](https://github.com/GonzaloVila/FitZone-Sports/commit/e11c9c8)

3. **`SocioOut` expone `nombre` y `email`**
   - El contrato los marca `required` y el código no los devolvía. Se toman de la relación con `Usuario`, así que toda lectura de `Socio` ahora incluye ese relation, y las que resolvían por unique pasaron a `findUnique` con `include`.
   - Por esto los testes de M1 verifican el `POST` y el `PATCH`, no solo el `GET`: si el shape cambia, tiene que cambiar en los tres caminos.
   - [commit e11c9c8](https://github.com/GonzaloVila/FitZone-Sports/commit/e11c9c8)

4. **Parámetros fantasma en el Swagger generado**
   - Al renombrar las rutas y los `@Param` a `snake_case`, los `@ApiParam` manuales quedaron con el nombre viejo. Como `@nestjs/swagger` **introspecta los `@Param` en runtime** (no hace falta el plugin de la CLI), cada operación documentaba un parámetro extra inexistente: `POST /ingresos/{ingreso_id}/egreso` declaraba `ingreso_id` **y** `ingresoId`. Un cliente generado pedía el parámetro que no existe.
   - En `GET /usuarios/{id}` no se veía porque ambos nombres coinciden y colapsan en uno, que es exactamente por lo que el bug pasó inadvertido.
   - **Verificado empíricamente**: se generó el documento con `SwaggerModule.createDocument` y se comparó operación por operación contra el YAML del vault. Las **17 operaciones de M1/M2 coinciden en path, `operationId` y path params**. Las 29 restantes son módulos todavía no implementados.
   - [commit e11c9c8](https://github.com/GonzaloVila/FitZone-Sports/commit/e11c9c8)

5. **DBML alineado con el `schema.prisma`**
   - Las columnas `String` son `text` en la base, no `varchar(N)`. Se sacó el ancho que estaba inventado en el DBML y se documentó que la validación de longitud vive en los DTOs.
   - Los 9 enums nativos de Postgres se documentan como `varchar` con sus valores permitidos en comentario, porque dbdiagram no soporta enums. Inventario verificado: 34 `int`, 15 `text`, 11 `timestamp`, 9 `varchar`, 3 `decimal`, 2 `boolean` = 74 columnas, y las 20 referencias resuelven contra la base real.
   - [commit e11c9c8](https://github.com/GonzaloVila/FitZone-Sports/commit/e11c9c8)

6. **`GET /socios` y `GET /usuarios` con filtros y paginación**
   - Lo que el contrato ya declaraba y faltaba implementar. Filtros de socios: `sede_origen_id`, `estado_membresia`, `plan`, `nombre`. De usuarios: `rol`, `nombre`, `email`.
   - Los dos filtros de membresía se acumulan en el mismo objeto para que Prisma los ANDee sobre la relación. Como `membresia` es opcional en el schema, filtrar por membresía **excluye** a los socios que no tienen ninguna: es la semántica correcta y queda documentado en el código para que no se lea como un olvido.
   - `OpcionesPaginacion` se muda de `sede.repository.ts` a `commons/paginacion.ts` porque lo comparten los repos de M1 y M2.
   - [commit 09696e4](https://github.com/GonzaloVila/FitZone-Sports/commit/09696e4)

#### Verificación

- `tsc --noEmit`, `npm run build` y e2e en verde sobre el estado final (`14/14`). El commit de consistencia se verificó **aislado**, con `git stash --keep-index`, y da `12/12`: los 2 tests que faltan son los del listados, que van en el commit siguiente.
- Contrato: 46 endpoints, 46 `operationId` únicos, 225 `$ref` resueltos, 39 schemas, 127 propiedades, 0 nombres en camelCase.
- Base compartida después del deploy: 14 tablas y 74 columnas idénticas al `schema.prisma` en nombre, tipo y nullability; 20 FKs intactas; `exq_reserva_turno` e `ingreso_usuario_abierto_unq` preservados; 39 filas antes y después, sin pérdida.

#### Pendientes que siguen abiertos

1. **`GET /ingresos` y `GET /ingresos/{ingreso_id}`**: el contrato los declara y M2 no los implementó. Es el único faltante de M2.
2. **Rama `desarrollo-m3`**: quedó con `Socio.sede_id` en su `schema.prisma` y sin las dos migraciones nuevas. Si alguien corre `prisma migrate dev` desde ahí, Prisma va a querer **borrar `Pago.fecha_pago`** y **revertir `sede_origen_id`**, deshaciendo esto en la base compartida. Hay que avisar al equipo y traer los cambios de main.
3. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml`, en el vault). Es la fuente de verdad de la API y no está versionado: nadie lo recibe con un `git pull`. Decisión pendiente de Gonzalo, no se tocó en esta entrada.
4. **Convención de integración**: el propio `LOG.md` dice que entra por PR a `main` con revisión de ≥1 integrante, pero estos dos commits se pushearon directo a `main` por indicación de Gonzalo.
5. **Auditorías de M1 y M2**: siguen sin hacer, son el siguiente bloque de trabajo.

---

## Unidad II — Módulo 3: Clases Grupales (RF-06..RF-08) · Santiago Rayn + Gonzalo Vila (Pair Programming)

### Semana 6 · SCRUM-11c — Implementación completa de M3 (agenda, reservas y lista de espera)

**Fecha:** 26/09/2026 · **Rama:** `desarrollo-m3`

#### Actividades

1. **RF-06 — Gestión de agenda:** Endpoints `POST /clases`, `GET /clases` y `GET /clases/:id`. DTOs con `horario` ISO-8601 UTC, validación de sede vía `SEDE_VALIDATION_PORT` y cálculo dinámico de aforo disponible en `PrismaClaseRepository`.
2. **RF-07 — Reservas y cancelación:** Transacción atómica en `PrismaReservaClaseRepository` con lock pesimista (`SELECT ... FOR UPDATE`) sobre la clase e índice parcial único `unq_reserva_clase_socio_activa`. Validaciones de regla de negocio en `ReservasClasesService`: ventana de reserva (48 hs antes), cancelación sin penalidad (2 hs antes) y control de mora vía extensión de `MembershipValidationPort` (403 `socio-en-mora`).
3. **RF-08 — Lista de espera y Observer:** Patrón GoF (`CupoLiberadoSubject` y `NotificarSociosEsperaObserver`) disparado al cancelar una reserva. Enlistado solo en clases llenas, baja lógica a `CANCELADO` (enum `EstadoEspera` ampliado) y confirmación first-come atómica en `POST /esperas-clases/:id/confirmacion`.
4. **Integración y QA:** `ClasesModule` registrado en `AppModule` con Swagger en `main.ts`, casos de uso documentados en `docs/UserCaseDiagrams/Modulo3_Clases_CasosDeUso.md` y suite e2e en `test/m3.e2e-spec.ts` (incluye prueba de estrés concurrente con `Promise.all`: 1 éxito, 9 rechazos 409). Build y tipado en verde (`npm run build`).

#### Decisiones tomadas

1. **Lock Pesimista sobre Optimistic Locking:** `SELECT ... FOR UPDATE` sobre la fila de `Clase` garantiza serialización sin sobreventa ni loops de reintento.
2. **`horario` como ISO-8601 UTC string:** Estandarizado a `YYYY-MM-DDTHH:mm:ssZ` (20 caracteres) para mantener compatibilidad con la columna de base de datos.
3. **Baja lógica en lista de espera:** Se agrega `CANCELADO` a `EstadoEspera` en Prisma para permitir salir de la espera preservando auditoría.

---

## Unidad II — Consistencia del contrato de errores y cierre de M3 · Gonzalo Vila

### Semana 6 · SCRUM-11c — Errores 4xx en español y listados paginados de M3

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **Detalles 4xx en español (`fix(commons)`):** los 400 de `ParseIntPipe` y body-parser, y el 404 de ruta inexistente, llegaban con el detalle crudo del framework — en inglés, y en el 404 solo se repetía el path que ya viaja en `instance`. Se agrega `CLIENT_DETAILS` (detalle fijo por status) y `resolveDetail()`, que sustituye el detalle de todo 4xx y deja el original en `logger.debug` para diagnóstico servidor. Los 5xx conservan el detalle. El flujo de `ProblemException` y el 422 del `ValidationPipe` no cambian. **Corregido después:** este commit sustituía también el detalle de los errores de dominio, no solo del framework. Ver la entrada de la auditoría de M1.
2. **Listados paginados de M3 (`feat(m3)`):** el contrato declaraba cuatro endpoints que faltaban: `GET /clases/{clase_id}/reservas`, `GET /reservas-clases`, `GET /clases/{clase_id}/espera` y `GET /esperas-clases`. DTOs de query con lista blanca de filtros y paginación, orden estable (fecha desc + id desc) y 404 por clase inexistente también en los listados. `GET /clases` pierde el filtro `fecha`, que no estaba en el contrato.
3. **Contrato e2e de 4xx (`test(e2e)`):** 7 casos nuevos en `test/errores-4xx.e2e-spec.ts` que fijan el comportamiento transversal de los errores del framework: JSON mal formado, path param no numérico, ruta inexistente, método no soportado y DTO inválido, todos en `application/problem+json`.
4. **Alineación del vault:** `TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md` quedan alineados con el comportamiento real. El contrato corregía decisiones previas: las ventanas temporales de 48 h y 2 h devuelven 409 (no 422) porque son conflictos con el estado del recurso; `confirmarEspera` devuelve 204 sin cuerpo; `crearClase` declara su 409; los nueve endpoints de M1 declaran su 400. Se agregan los componentes `SocioEnMora`, `ConflictoReservaClase`, `ClaseFueraDeHorario` y `VentanaCancelacionCerrada`, se elimina `CupoCompleto` y se corrige `ClaseOut`, que declaraba `cupos_disponibles` cuando el DTO expone `cupo_disponible` y `reservas_confirmadas`.

#### Decisiones tomadas

1. ~~**Los 4xx del framework se sustituyen, no se traducen:** en `src/` no hay ningún `throw new` de Nest, todo el código propio tira `ProblemException` y corta antes en `toProblemBody()`.~~ **Esta premisa era falsa** y la decisión quedó anulada. En `src/` hay 33 `throw new` de Nest (14 de M1, 3 de M2, 16 de M3), así que `resolveDetail()` estaba borrando el mensaje de los 404 y 409 de dominio: un 404 respondía *"La ruta solicitada no existe"* con la ruta existiendo, y los 409 perdían el motivo del conflicto. La premisa correcta es la inversa: **todo 4xx de dominio debe lanzarse como `ProblemException`** y cortar antes en `toProblemBody()`; lo que llega a `resolveDetail()` es framework. Corregido en la entrada de la auditoría de M1.
2. **No se implementa 405:** Express 5 no lo distingue de forma nativa y el vault no lo declara en ninguna operación. Se acepta 404 tanto para ruta inexistente como para método no soportado; agregar 405 exigiría un middleware global con el costo que no se justifica para este alcance.
3. **422 declarado donde el ValidationPipe lo produce:** `crearReservaClase` y `anotarseEnEspera` reciben DTO con `ParseIntPipe` + `ValidationPipe`, que producen 422 en runtime. El contrato lo declaraba solo en algunos endpoints; se completa.
4. **Los commits van en tres, no en uno:** el filtro de errores es transversal (toca toda la API) y su prueba e2e cruza M1 y M3, mientras que los listados son de M3. Mezclarlos habría dejado el cambio transversal clasificado como trabajo de un módulo. El `ApiBadRequestResponse` de `clases.controller.ts` quedó en el commit de M3 completo: partir un archivo de 9 líneas no compensaba y se documenta acá su origen transversal.

#### Verificación

- `npx tsc --noEmit` y `npm run build` en verde. e2e: **38/38 en 4 specs** (31 de M3 + 7 de 4xx).
- Contraste entre el código y el vault: **31/31 operaciones coinciden en ruta, verbo y status codes**; 0 divergencias. Los 9 schemas `*Out` coinciden campo por campo; 0 referencias `$ref` rotas y 0 componentes huérfanos.
- `ClaseOut` corregido: `required` pasa a los 8 campos reales y el ejemplo cuadra (18 − 5 = 13).
- El YAML se editó quirúrgicamente: los 23 comentarios se preservan y el encoding no cambia (vault en CRLF, Plan M3 en LF). Backups `pre-fase2.bak` y `pre-fase3.bak` de ambos archivos.

#### Commits

- [cf97644](https://github.com/GonzaloVila/FitZone-Sports/commit/cf97644) — `fix(commons)`: detalles 4xx en español.
- [1b70444](https://github.com/GonzaloVila/FitZone-Sports/commit/1b70444) — `feat(m3)`: cuatro listados paginados.
- [4f6e7a2](https://github.com/GonzaloVila/FitZone-Sports/commit/4f6e7a2) — `test(e2e)`: contrato de errores 4xx.

#### Pendientes que siguen abiertos

1. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no está versionado: nadie lo recibe con un `git pull`. Esta entrada deja registrada la enmienda de los 409 y del `ClaseOut`, pero un `git pull` no la reproduce. Sigue siendo decisión pendiente de Gonzalo.
2. **Auditorías de M1, M2 y M3:** sin hacer. El contrato y el código ya están alineados, así que se pueden arrancar.

---

## Unidad II — Módulo 3: respuesta de la confirmación de espera · Gonzalo Vila

### Semana 7 · SCRUM-11c — `confirmarEspera` pasa de 204 a 201

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **`POST /esperas-clases/{espera_id}/confirmaciones` pasa de 204 a 201:** la confirmación creaba la `ReservaClase` correcta pero descartaba su id, así que el socio no tenía forma de referenciar la reserva creada sin barrer `GET /reservas-clases` y cruzar la respuesta con la clase. Ahora responde 201 con el `ReservaClaseOutDto` completo y el header `Location`.
2. **El id se perdía en el service, no en la base:** `PrismaEsperaClaseRepository.confirmarEsperaConLock` ya devolvía `{ ok: true, reserva: { id, clase_id, socio_id, estado } }`, la forma exacta del DTO. Lo que lo descartaba era la firma `Promise<void>` de `EsperasClasesService.confirmarEspera`, que se agregó una línea `plainToInstance(ReservaClaseOutDto, resultado.reserva)`. El repositorio no necesitó cambios.
3. **Unificación con la convención de creación:** el endpoint replica el patrón de los otros siete que crean recursos — `@ApiCreatedResponse` con `type`, `@Res({ passthrough: true })` y `res.setHeader('Location', ...)`. Se saca el `@HttpCode(NO_CONTENT)` explícito porque el default de `@Post` ya es 201.
4. **Contrato actualizado:** el vault pasa a declarar `"201"` con `content: application/json` referenciando `ReservaClaseOut` y el header `Location`, y se reescribe el párrafo de la `description` que describía el 204 sin cuerpo. El `Plan de Trabajo M3` se corrige en la lista de endpoints, en el paso 11 del service y en el paso 12 del controller.

#### Decisiones tomadas

1. **201 con el DTO completo en vez de un DTO mínimo:** se reutiliza `ReservaClaseOutDto` / `ReservaClaseOut` en vez de inventar un schema con solo `reserva_id` y `clase_id`. Los cuatro campos ya existen en el vault y en el DTO, y responder lo mismo que `crearReservaClase` evita que el cliente tenga dos formatos para leer una reserva.
2. **`Location` apunta a `/api/v1/reservas-clases/{id}`:** ese endpoint ya existe (`obtenerReservaClase`), así que la URL es resoluble y sirve para el `GET` de seguimiento sin cambiar la ruta de la reserva.

#### Verificación

- `npx tsc --noEmit` y `npm run build` en verde. e2e: **38/38 en 4 specs**.
- El caso de first-come pasa a exigir 201 y agrega aserciones de body (`estado`, `clase_id`, `socio_id`, `id`) y del header `Location`. Se suma la comprobación de que el `id` devuelto en el body es el mismo que quedó persistido en `reservaClase`, que es exactamente el bug que se estaba corrigiendo. Los otros tres `expect(204)` del spec (cancelación ×2 y `salirDeEspera`) no se tocan porque siguen siendo 204 legítimos.
- Vault: YAML parsea, la operación expone 201/404/409, el `$ref` apunta a `ReservaClaseOut` (`required: [id, clase_id, socio_id, estado]`), 243 `$ref` totales con 0 rotas y 0 schemas huérfanos. Backups `pre-fase4.bak` de vault y Plan.
- Contraste contra el Swagger que generan los decoradores: 201/404/409, header `Location`, `content: application/json` y `$ref: ReservaClaseOutDto`, idéntico a lo que declara el vault.

#### Commits

- `fix(m3): confirmarEspera devuelve 201 con la reserva creada` — este mismo commit. A diferencia de las entradas anteriores, acá el código y esta bitácora van en un solo commit, así que no se cita hash: un commit no puede contener el suyo propio. Para el detalle de qué cambió, ver el `#### Actividades` de arriba y el `git show` del commit.

#### Pendientes que siguen abiertos

1. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no está versionado: nadie lo recibe con un `git pull`. Esta entrada deja registrada la enmienda de los 409, del `ClaseOut` y del 201, pero un `git pull` no la reproduce. Sigue siendo decisión pendiente de Gonzalo.
2. **Auditorías de M1, M2 y M3:** sin hacer. El contrato y el código ya están alineados, así que se pueden arrancar.

---

## Unidad II — Auditoría del módulo 1 · Gonzalo Vila

### Semana 7 · SCRUM-11d — M1 contra el contrato: errores de dominio, `UsuarioOut` y validaciones

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **El filtro borraba el mensaje de los errores de dominio (crítico).** `cf97644` hizo que `resolveDetail()` sustituyera el `detail` de todo 4xx, y su justificación —"en `src/` no hay ningún `throw new` de Nest"— era falsa: hay 33. Los 30 de 404 volvían con *"La ruta solicitada no existe o el recurso no fue encontrado."* cuando la ruta existía, y los 3 de 409 perdían el motivo con *"La solicitud no pudo procesarse."*. La suite no lo detectaba porque ningún spec assertaba el body de un 404 o 409 de dominio: solo el status.
2. **`resolveDetail()` pasa a fail-safe.** Sustituye solo las cinco formas que puede producir el framework (ruta o método inexistente, `ParseIntPipe` y las tres variantes del body-parser de Node). Cualquier otro 4xx conserva su `detail` y emite un `logger.warn` con método, ruta y mensaje, de modo que un `NotFoundException` de dominio que se cuele a futuro avisa en lugar de perder el mensaje en silencio. El default es preservar, no sustituir.
3. **Las 33 excepciones se migran a `ProblemException`,** en tres commits por módulo. Los 30 `NotFoundException` pasan por `recursoNoEncontrado()` conservando el texto; los 3 `ConflictException` por `conflictoDeDominio()`. `GENERIC_TYPE` y `TITLES` se mueven a `problem.exception.ts` para que el filtro y los helpers no dupliquen las constantes.
4. **Los 409 de M1 pierden el `title` genérico.** El filtro devolvía `"Conflicto"` para los tres; el contrato declara tres distintos en `Conflict`, `SocioExistente` y `MembresiaExistente`. Pasan a ser `"Conflicto de unicidad"`, `"El usuario ya es socio"` y `"Conflicto de membresía existente"`.
5. **Los `detail` de los 409 se alinean al vault, no al revés,** por decisión de Gonzalo. El de dni o email ahora distingue el campo, comparando `existente.dni` contra el dni recibido; `buscarPorDniOEmail` ya devuelve la entidad completa, así que no hizo falta tocar la query. El de socio lleva el id del usuario. El de membresía pasa a *"El socio ya tiene una membresía activa."*
6. **`instance` se completa en las respuestas de `ProblemException`.** `toProblemBody()` las devolvía sin el path, y el contrato lo declara opcional en `components.schemas.Problem`, así que no era violación; pero dejaba a las 20 `ProblemException` de M2 y M3 como las únicas respuestas de la API sin `instance`.
7. **Nuevo `test/errores-dominio.e2e-spec.ts`** con 10 casos que assertan `type`, `title`, `status`, `detail` e `instance` de 6 de 404 (M1, M2 y M3) y de los 4 de 409 de M1, incluidas las dos ramas de dni y email. Se escribió **antes** de la migración y falló 4 de 10: los 6 de 404 ya pasaban con el fail-safe y los 4 de 409 seguían cayendo en el `title` colapsado. Ese reparto es la evidencia de que el spec cubre el bug.
8. **`UsuarioOut` tenía el `required` mal en los dos lados, en direcciones opuestas.** El vault no declaraba `required` (cero campos obligatorios) y el decorador marcaba los 7. Prisma es la fuente de la verdad: `id`, `rol`, `dni`, `nombre` y `email` son `String`/`Int` sin `?`; `telefono` y `foto_url` son `String?`. El vault pasa a `required: [id, rol, dni, nombre, email]` y los dos opcionales reciben `required: false`.
9. **Seis campos nullable salían con `type: object` en el Swagger.** El plugin no infiere una unión con `null` y cae al default: `telefono` y `foto_url` en `UsuarioOutDto` y `ModificarUsuarioDto`, y `fecha_notificacion` y `fecha_confirmacion` en `EsperaOutDto`. Es **preexistente** y hacía que el Swagger generado no coincidiera con el vault. Se declara `type` explícito.
10. **Cinco restricciones que el código aplicaba y no declaraba,** ahora visibles en el contrato: `dni.pattern`, `email.maxLength: 254`, `minimum: 1` en `usuario_id` y `sede_origen_id`, y `format: email` en el email de los dos `*Out`. La revisión inicial, que reportaba siete ausencias, exageraba: `contrasenia`, `nombre`, `telefono`, `rol`, `plan` y los límites de `page`/`per_page` ya coincidían.
11. **`UsuarioPatch` no aceptaba el `null` que el contrato promete.** `telefono` y `foto_url` se declaran `nullable: true` en el vault pero el tipo era `string | undefined`. Pasaron a `string | null`. El test nuevo manda `null`, verifica que el PATCH responde `null` y que el `GET` siguiente lo confirma en la base, o sea que llega a Prisma: `modificar()` compara con `!== undefined` y no con falsy, así que no había defecto de lógica, solo de tipos.
12. **El vault tenía `format: date` donde la API devuelve timestamp.** `SocioOut.fecha_alta`, `MembresiaOut.fecha_inicio` y `MembresiaOut.fecha_fin` estaban como `date`; Prisma serializa `DateTime` a ISO completo, verificado contra la base (`2026-05-30T01:53:51.988Z`). Corregidos a `date-time`. El código ya decía `date-time`.

#### Decisiones tomadas

1. **Migrar a `ProblemException` en vez de revertir el filtro.** El código ya estaba a mitad de migración: 20 casos con URIs `https://fitzone.app/errores/...` en M2 y M3. Revertir `resolveDetail()` devolvía los 33 mensajes pero dejaba el 400 de JSON mal formado en inglés otra vez. La alternativa de distinguir por la forma del mensaje era frágil. Migrar hace verdadera la premisa y deja cada error de dominio con su `type` documentable.
2. **El fail-safe va más allá de la migración:** sustituir solo lo reconocido y avisar con `warn` ante lo desconocido. Cubre el error de hoy y además evita que se repita en silencio.
3. **Los `detail` de los 409 los manda el vault, no el código,** por decisión explícita de Gonzalo. Se invierte el criterio que se había usado en las fases anteriores y por eso cambian tres mensajes que el consumidor ve.
4. **Los 30 `detail` de 404 conservan su texto específico** ("No existe la sede indicada.", "No existe la clase indicada.") en vez de unificarlos al del componente `NotFound`. El vault tiene un solo componente con un example representativo y el `detail` es texto libre, así que no había conflicto real; aplanarlos perdería información.
5. **El filtro fail-safe con `warn` se acepta como red de seguridad permanente,** no como deuda a pagar después.
6. **Se corrige el `LOG.md` de la entrada anterior en el lugar,** sin reescribir historia: la decisión anulada queda tachada con la premisa falsa explícita y el enlace a esta entrada.

#### Verificación

- `npx tsc --noEmit` y `npm run build` en verde. e2e: **49/49 en 5 specs** (antes 38/38 en 4). El spec nuevo se ejecutó primero contra el código sin migrar y falló 4 de 10, que es la prueba de que cubre el defecto.
- Contraste automático entre el Swagger que generan los decoradores y el vault, sobre los 9 schemas de M1: **0 divergencias de `required` y 0 de restricciones.** El `required` de `UsuarioOut` pasó de 7 a 5, el que declara Prisma.
- `type: object` restantes en los 21 schemas del documento generado: **ninguno** (eran 6).
- Vault: YAML parsea, 243 `$ref` con 0 rotas, 0 schemas huérfanos, 30 paths y 47 operaciones sin cambios. Encoding preservado (CRLF, sin BOM). Backup `pre-m1.bak`.
- Un defecto del spec nuevo lo detectó la suite: creaba un Socio que no registraba para la limpieza, y el borrado del Usuario fallaba por la FK `Socio_usuario_id_fkey`. Corregido.
- **Fragilidad latente corregida:** `m1.e2e-spec.ts` listaba `/usuarios` con el `per_page` por defecto de 20 y buscaba su fixture en esa página. Con otra suite agregando usuarios en paralelo —y vitest corre los archivos concurrentemente contra la misma base— el fixture se caía de la página. Pasa a pedir `per_page=100`. No lo había detectado ninguna corrida anterior; el spec nuevo lo expuso.

#### Commits

- [ab99e7b](https://github.com/GonzaloVila/FitZone-Sports/commit/ab99e7b) — `fix(commons)`: `resolveDetail` pasa a fail-safe y distingue dominio de framework.
- [22450d3](https://github.com/GonzaloVila/FitZone-Sports/commit/22450d3) — `fix(commons)`: completa `instance` en las respuestas `ProblemException`.
- [2949850](https://github.com/GonzaloVila/FitZone-Sports/commit/2949850) — `fix(m1)`: migra las 14 excepciones de M1.
- [792d9eb](https://github.com/GonzaloVila/FitZone-Sports/commit/792d9eb) — `fix(m2)`: migra las 3 excepciones de `IngresosService`.
- [14bddfa](https://github.com/GonzaloVila/FitZone-Sports/commit/14bddfa) — `fix(m3)`: migra las 16 excepciones de M3.
- [e702aa3](https://github.com/GonzaloVila/FitZone-Sports/commit/e702aa3) — `test(e2e)`: fija el `detail` y el `title` de los 404 y 409 de dominio.
- [44a4772](https://github.com/GonzaloVila/FitZone-Sports/commit/44a4772) — `fix(m1)`: alinea el Swagger generado con el contrato en `UsuarioOut` y las validaciones.
- [b99a3ea](https://github.com/GonzaloVila/FitZone-Sports/commit/b99a3ea) — `fix(m3)`: declara `type` en las fechas nullable de `EsperaOutDto`.
- `docs(log)`: corrección de la premisa anulada y esta entrada — este mismo commit.

#### Pendientes que siguen abiertos

1. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no está versionado: nadie lo recibe con un `git pull`. Esta entrada deja registrada la enmienda de `UsuarioOut`, de las validaciones y de los `format: date-time`, pero un `git pull` no la reproduce. Sigue siendo decisión pendiente de Gonzalo.
2. **`number` contra `integer` en 36 campos numéricos.** El vault declara `type: integer` y el Swagger generado dice `type: number`: 8 en M1, 11 en M2, 17 en M3. En JSON no hay diferencia, pero un generador de clientes puede elegir `int` o `number`. La corrección correcta es declarar `type: integer` en los decoradores, y son 36 campos en tres módulos — **no se hizo porque el alcance de esta auditoría era M1 y M2/M3 no están auditados.** Queda como decisión.
3. **Sin validar: `foto_url` no se valida como URL.** Ni el código ni el contrato lo hacen: solo `@IsString()`. Por decisión de Gonzalo no se agrega `@IsUrl()`, porque rechazaría payloads que hoy pasan, así que la limitación queda documentada y no corregida.
4. **Auditorías de M2 y M3:** sin hacer. El mismo diff automático que se usó acá está listo para correrlas: expone 36 divergencias de tipo más las de restricciones que reportó el contraste de M1, incluyendo `Problem.errors` —el array de errores de validación del 422— que el código expone y el vault no declara.
### Semana 7 · SCRUM-11e — Cierre de M1: `type: integer` en los ocho campos numéricos

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **El vault declara `type: integer` y el Swagger generado decía `type: number`** en los ocho campos numéricos de M1. La causa es que los ocho `@ApiProperty` no declaraban `type`, así que el plugin del `@nestjs/swagger` caía a su default `number` para un `number` de TypeScript. Se agrega `type: 'integer'` a los ocho. Con esto la auditoría de M1 queda en **0 divergencias de `required`, 0 de restricciones y 0 de tipo** sobre sus nueve schemas.
2. **Los ocho campos, en cinco archivos:** `UsuarioOut.id`; `SocioOut.id`, `.usuario_id` y `.sede_origen_id`; `MembresiaOut.id`; `SocioIn.usuario_id` y `.sede_origen_id`; y `SocioPatch.sede_origen_id`. Los dos de `SocioIn` y el de `SocioPatch` ya tenían `@IsInt()` y `@Min(1)`; a los `*Out` no se les agrega validación porque son de salida y no los recorre el `ValidationPipe`.
3. **No se modificó el vault.** En los ocho casos el vault ya decía `integer`: el que estaba mal era el código.
4. **Sin efecto en runtime.** Es anotación de OpenAPI: en JSON `1` es indistinguible de `1` con o sin `integer`. El único efecto observable es en clientes generados, que pasan a mapear esos campos como `int` en vez de `number`, que es lo que el contrato dice.

#### Decisiones tomadas

1. **Sólo los ocho de M1, no los treinta y cinco del proyecto.** La misma divergencia aparece en 11 campos de M2 y 16 de M3, y el arreglo es idéntico. Se acotó a M1 por decisión de Gonzalo porque M2 y M3 no están auditados: mezclarlos en un commit `fix(m1)` sin haber pasado el resto de la superficie de esos módulos por el contraste automático sería afirmarlos alineados cuando no lo están.
2. **El vault manda en la dirección de siempre.** En los casos anteriores la acción fue enmendar el vault; acá no hizo falta porque ya era el correcto.

#### Verificación

- `npx tsc --noEmit` y `npm run build` en verde. e2e: **49/49 en 5 specs**, idéntico a antes — la suite no lo exercise porque el cambio no altera runtime, y esa es justamente la razón de no haberlo tomado como señal.
- Contraste automático sobre los nueve schemas de M1: **0 de `required`, 0 de restricciones, 0 de tipo.** Antes de este commit eran 0, 0 y 8.
- `git diff` revisado a mano: cinco archivos, ocho inserciones y seis eliminaciones, todas las líneas tocadas con `type: 'integer'`. Ningún `@ApiProperty` perdió su `example`, `description` o `minimum`, y `SocioPatch.required` sigue sin incluir `sede_origen_id` porque declarar `type` en un `@ApiPropertyOptional` no lo vuelve obligatorio.

#### Commits

- `fix(m1): declara type integer en los ocho campos numéricos de los DTO de M1` — este mismo commit.

#### Pendientes que siguen abiertos

1. **`number` contra `integer` en 27 campos de M2 y M3, más `Problem.status`.** Once en M2 (`IngresoIn.sede_id`, `IngresoIn.usuario_id`, `IngresoOut.id`, `.sede_id`, `.usuario_id`, `SedeOut.id`, `SedeOut.aforo_maximo`, `AforoOut.aforo_actual`, `AforoOut.aforo_maximo`, `AforoOut.restante`, `SedeIn.aforo_maximo`) y dieciséis en M3 (`ClaseIn.sede_id`, `ClaseIn.capacidad`, `ClaseOut.id`, `.sede_id`, `.capacidad`, `.reservas_confirmadas`, `.cupo_disponible`, `EsperaIn.socio_id`, `EsperaOut.id`, `.clase_id`, `.socio_id`, `ReservaClaseIn.clase_id`, `.socio_id`, `ReservaClaseOut.id`, `.clase_id`, `.socio_id`). Con `Problem.status` son 28 en total; el proyecto tenía 36 antes de esta entrada, de los cuales 8 eran de M1. Mismo arreglo de una línea por campo, a resolver en las auditorías de M2 y M3.
2. **Ocho restricciones que el vault declara y el código no.** Seis de M2: `SedeIn.nombre` con `minLength: 1` y `maxLength: 100`, `SedeIn.direccion` con `minLength: 1` y `maxLength: 200`, `SedeIn.aforo_maximo` con `minimum: 1`, y `IngresoIn.fecha_hora_ingreso` con `format: date-time`. Dos de M3: `ClaseIn.horario` y `ClaseOut.horario` con `format: date-time`. **No son metadata: son validadores ausentes**, así que a diferencia del punto 1 hay que decidir si el backend debe validar lo que el contrato ya promete o si el vault sobre-declara. Se difieren a las auditorías de M2 y M3.
3. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no está versionado. Sigue siendo decisión pendiente de Gonzalo.
4. **Sin validar: `foto_url` no se valida como URL.** Ni el código ni el contrato lo hacen: sólo `@IsString()`. Por decisión de Gonzalo no se agrega `@IsUrl()`, porque rechazaría payloads que hoy pasan.
### Semana 7 · SCRUM-11f — Capa de operaciones de M1: parámetros, `Problem.errors` y `Problem.status`

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **El contraste anterior estaba incompleto, y el `LOG.md` de la entrada previa lo daba por cerrado.** Los comparadores usados hasta acá miraban los nueve schemas de M1: `required`, restricciones y tipo. Nunca compararon la capa de operaciones — verbos, status codes, parámetros, cuerpos y cuerpos de respuesta — que es donde el documento declara la mayor parte de su información. Al medirla aparecieron cuatro causas raíz que ya estaban en el código desde antes de la auditoría. Queda anotado acá porque el número "0/0/0" de la entrada SCRUM-11e era cierto sólo para los schemas, y la frase con la que se cerró sonaba más amplia de lo que era.
2. **`Problem.errors` no estaba en el contrato.** El backend lo emite desde siempre: `problem.filter.ts:129` toma `response.message` del `ValidationPipe` y lo pasa tal cual en el `errors` del 422, y `ProblemDetailsDto` ya lo declaraba como `type: [String]` con la descripción *"Solo en errores de validación (422): lista de reglas incumplidas."* El vault, en cambio, no lo tenía. **Se corrige el vault, no el código:** RFC 9457 admite miembros de extensión, el valor es real y el swagger ya lo declaraba. Se agrega `errors` a `components.schemas.Problem` fuera de `required`, y se suma al example de `components.responses.ValidationError`, que es la única respuesta donde efectivamente aparece. Con esto quedan documentadas de una vez las 51 referencias a `Problem` del documento.
3. **`Problem.status` decía `number` en el código y `integer` en el vault.** Se agrega `type: 'integer'` en `problem-details.dto.ts`. Es un archivo de `commons` y afecta a los tres módulos, pero se incluye acá porque es el mismo `Problem` que ya se estaba enmendando en el punto 2, y dejar la mitad sin corregir obligaría a volver.
4. **Los 14 parámetros de M1.** Ocho `@ApiParam` con `type: Number` —el constructor de JavaScript, que el plugin traduce a `type: number`— pasan a `type: 'integer'`: dos de `id` en `usuarios.controller.ts` y seis de `socio_id` repartidos en `socios.controller.ts` (3) y `membresias.controller.ts` (3). Y seis campos de los query DTO: `page` y `per_page` de `ListarUsuariosQueryDto`, `sede_origen_id`, `page` y `per_page` de `ListarSociosQueryDto` reciben `type: 'integer'`, y el filtro `email` de `ListarUsuariosQueryDto` recibe `format: 'email'`.
5. **El backend ya validaba lo que el contrato pedía; faltaba el metadato.** Es lo relevante del punto 4: `email` ya tenía `@IsEmail()`, y `page`, `per_page` y `sede_origen_id` ya tenían `@IsInt()`. La validación nunca estuvo ausente — lo que faltaba era que el Swagger lo dijera, así que un cliente generado no podía enterarse de que `page=1.5` se rechaza. Por eso los quince cambios son metadato puro y ninguno toca un validador.
6. **`additionalProperties: false` en los seis request bodies de M1 se acepta como limitación del generador.** El vault lo declara y el Swagger generado no. Ojo con el diagnóstico: acá el código **no** está mintiendo. `main.ts:15-18` configura el `ValidationPipe` con `whitelist: true` y `forbidNonWhitelisted: true`, o sea que los campos desconocidos se rechazan de verdad; lo que no se refleja es en el documento. Decisión de Gonzalo: dejarlo así y documentarlo, en vez de escribir un decorador propio por DTO para una propiedad que `@nestjs/swagger` no expone de forma nativa.
7. **Dos falsos positivos que costaron una revisión de más.** El `required` de `SocioOut` aparece en el código como `[id, usuario_id, nombre, email, sede_origen_id, fecha_alta]` y en el vault como `[id, usuario_id, sede_origen_id, fecha_alta, nombre, email]`. Es el mismo conjunto de seis: en OpenAPI 3 `required` es un array sin orden, así que se normaliza por conjunto antes de comparar. Y el orden de las claves en el JSON serializado (`properties` antes o después de `required`) no es una diferencia. Sin esas dos normalizaciones el comparador reporta 67 divergencias donde hay cero.

#### Decisiones tomadas

1. **M1 solamente en los parámetros**, por decisión de Gonzalo: se está auditando módulo por módulo y M2 y M3 todavía no pasaron por el contraste. Por lo mismo, el arreglo de los `@ApiParam` y query DTO de los otros módulos queda para sus auditorías.
2. **`Problem.errors` se documenta en el contrato en lugar de quitarse del código.** El backend lo devuelve, el DTO ya lo describía y RFC 9457 lo permite; la alternativa habría sido perder información que el cliente recibe hoy.
3. **`Problem.status` entra aunque sea `commons`.** Se hace la excepción a la regla de no tocar fuera de M1 porque compartir el mismo schema hacia medias correcciones sería peor que la regla.
4. **`additionalProperties: false` no se implementa.** Limitación del generador aceptada y documentada, no deuda a pagar después.

#### Verificación

- `npx tsc --noEmit` y `npm run build` en verde. e2e: **49/49 en 5 specs**, idéntico a las tres entradas anteriores — otra vez la suite no lo exercise porque no hay cambio de runtime.
- Comparador de operaciones sobre las doce de M1, con `$ref` resueltos, claves ordenadas y `required` normalizado por conjunto: **0 divergencias reales.** Antes de este commit eran 14 de parámetros, 30 de `Problem.status`, 30 de `Problem.errors` y 4 por orden de `required`.
- Comparador de schemas sobre los nueve de M1: sigue en **0 de `required`, 0 de restricciones y 0 de tipo.**
- Las 6 divergencias de `additionalProperties` se excluyen del resultado por decisión, no porque el comparador no lo mire; si se cuentan, M1 queda en 6 y todas son la misma limitación del punto 6.
- `git diff` revisado a mano: seis archivos, quince inserciones, trece eliminaciones. Todas las líneas tocadas agregan `type` o `format`; ningún decorador de `class-validator` aparece en el diff.
- Vault: YAML parsea, 243 `$ref` con 0 rotas, 0 schemas huérfanos, 30 paths y 47 operaciones sin cambios, encoding preservado (CRLF, sin BOM). Backup `pre-errors.bak`.
- Una caída durante la edición: el `description` de `errors` quedó sin comillas y contenía `": "`, que YAML lee como inicio de mapping; el archivo no parseaba. Lo detectó el validador en la verificación inmediata y se entrecomilló. No llegó a commitearse.

#### Commits

- `fix(m1): declara type integer en los parametros de M1 y documenta Problem.errors` — este mismo commit.

#### Pendientes que siguen abiertos

1. **`additionalProperties: false` ausente en el Swagger.** Los seis request bodies de M1; y los de M2, M3, M4 y M5 también lo declararán en el contrato sin que el generador lo refleje. Aceptado como limitación del generador, no corregido.
2. **Los mismos dos defectos en M2, M3, M4 y M5:** `type: number` donde el vault dice `integer` en los `@ApiParam` y query DTO, y las divergencias de propiedades ya documentadas en la entrada SCRUM-11e (27 campos de tipo más ocho restricciones ausentes en M2 y M3). El comparador de operaciones usado acá es reutilizable tal cual.
3. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no está versionado. Sigue siendo decisión pendiente de Gonzalo.
4. **Sin validar: `foto_url` no se valida como URL.** Ni el código ni el contrato lo hacen: sólo `@IsString()`. Por decisión de Gonzalo no se agrega `@IsUrl()`, porque rechazaría payloads que hoy pasan.

### Semana 7 · SCRUM-11g — Orden de SocioOut.required y correccion de la medicion de paths

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **El orden de `required` en `SocioOut` era el unico de los nueve schemas de M1 que no coincidia.** El codigo emitia `[id, usuario_id, nombre, email, sede_origen_id, fecha_alta]` y el vault `[id, usuario_id, sede_origen_id, fecha_alta, nombre, email]`: mismo conjunto de seis campos, distinto orden. En OpenAPI 3 `required` es un array sin orden, asi que el vault ya era correcto y el comparador lo venia marcando como falso positivo. Gonzalo pidio igualar el orden, y se reordena `SocioOutDto` al del vault, con tres separadores (`// Identidad`, `// Origen y alta`, `// Datos de contacto`) para que se lea agrupado. Ningun decorador cambio: solo la posicion de las declaraciones. Como el `required` del vault esta en el mismo orden que su `properties`, alinear el DTO hace coincidir las dos cosas de una. Efecto lateral: el orden de las claves del JSON cambia en las respuestas 200 de `GET /socios`, `GET /socios/{socio_id}` y `PATCH /socios/{socio_id}`; ninguna asercion de los e2e dependia de ese orden.

2. **Correccion: la medicion de paths de la entrada anterior no aplico el prefijo global.** El comparador con el que se cerró SCRUM-11f nunca llamo a `setGlobalPrefix("api/v1")`, de modo que comparo los paths sin prefijo del codigo contra los del vault y dio coincidencia. El documento que la aplicacion sirve en `/docs` trae los paths con el prefijo:

   ```
   codigo  /api/v1/usuarios, /api/v1/socios/{socio_id}, ...
   vault   /usuarios,     /socios/{socio_id},     ...
   vault   servers: [{url: http://localhost:3000/api/v1}]
   ```

   Son dos convenciones distintas para expresar lo mismo: el codigo hornea el prefijo en los paths y no declara `servers`; el vault lo pone en `servers` y deja los paths limpios. Los cinco paths de M1 mapean 1:1 con las mismas operaciones y resuelven a las mismas URLs, asi que no hay divergencia funcional, pero la frase "5/5 paths coinciden" era inexacta y la diferencia de convencion quedo normalizada en silencio. Queda anotada.

3. **El comparador de esta ronda dio primero unas 30 diferencias falsas, por dos bugs mios.** Uno: resolvia los `$ref` del documento generado contra el vault, donde los nombres de schema no coinciden (`SocioOutDto` contra `SocioOut`), y devolvia `undefined` en decenas de lugares. Dos: ignoraba los `parameters` declarados a nivel de path, que en el vault es donde estan, y los reportaba como ausentes. Ninguno de esos bugs es el responsable del "0" de la entrada anterior —ese viene del punto 2, el prefijo no aplicado—, pero hacia falta un harness con las cuatro correcciones para poder sostener el 0 con confianza y no por accidente. El comparador final resuelve cada `$ref` contra su propio documento, fusiona los parametros de path con los de operacion, los ordena por `(in, name)` — su orden tampoco es significativo — y detecta ciclos con una pila de referencias.

4. **Un error mio que llego a recomendar como si fuera un bug.** Interpretere la ausencia de `servers` en el documento generado como "/docs esta roto y el Try it out da 404", y propuse agregar `.addServer("http://localhost:3000/api/v1")`. Es al reves: como el prefijo ya viene en los paths, agregar ese servidor produciria `/api/v1/api/v1/usuarios` y dejaria roto el `/docs` completo. El documento actual resuelve bien. Decision de Gonzalo: no agregar nada.

5. **Se miden por primera vez `operationId` y `tags`: 0 diferencias en las 12 operaciones.** Habian quedado fuera de los comparadores anteriores como "documentacion". `operationId` no es prosa: es de donde salen los nombres de metodo del cliente generado, asi que era el hueco mas relevante de los que quedaban. Coinciden los doce.

6. **Hallazgo nuevo: `summary` difiere en 7 de las 12 operaciones.** Solo prosa, mismo significado: "Socio por id" contra "Obtener socio por id", "Alta de usuario (perfil EXTERNO/RECEPCION/GERENTE)" contra "Registrar usuario". No se corrige: es ruido de documentacion, no de contrato.

7. **Hallazgo nuevo: los 11 responses de exito de M1 no tienen `example` en el vault.** Los 30 de error si, porque salen de los componentes compartidos; los `200` y `201` de usuarios, socios y membresias van con `schema` pero sin cuerpo de ejemplo. El codigo si tiene ejemplos por propiedad en los DTO, y se verifico que no se contradicen: de 26 ejemplos comparados, 5 identicos y 0 contradictorios. Es informacion complementaria que esta de un lado y no del otro.

8. **`SocioOutDto` contra el schema `SocioOut` del vault: no se renombra.** Es la misma categoria de divergencia cosmetica de documentacion, se resolveria renombrando la clase y los 3 imports, pero queda fuera por instruccion explicita de Gonzalo.

#### Decisiones tomadas

1. **Reordenar el DTO y no el vault.** El vault es la fuente de verdad de la API y ya era correcto; cambiarlo habria que tocar tambien el orden de `properties`, porque en el vault los dos bloques son coherentes entre si. Alinear el codigo deja el vault intacto.
2. **No agregar `.addServer()`.** El `/docs` funciona; agregarlo con el valor del vault duplicaria el prefijo.
3. **No renombrar `SocioOutDto`.**

#### Verificacion

- `npx tsc --noEmit` y `npm run build` en verde. e2e: **49/49 en 5 specs**, sin cambios: confirma que el reordenamiento de las claves del JSON no rompio ninguna asercion.
- Comparador de operaciones con el mapeo de prefijos corregido: **5 paths, 12 operaciones, 0 divergencias reales**, con `$ref` resueltos por documento, parametros de path y de operacion fusionados y ordenados, y `required` comparado por conjunto y ademas por orden.
- Los 9 schemas de M1: **0 diferencias de orden en `required` y en `properties`, 0 conjuntos distintos.** Antes de este commit, `SocioOut` era el unico con diferencia de orden.
- Se sigue excluyendo `additionalProperties` (limitacion aceptada del generador, 6 cuerpos de M1) y `description`, `summary`, `example` y `title` (prosa).
- El vault no se toco en esta ronda: sigue en 91614 bytes, CRLF, sin BOM, 243 `$ref` sin rotas y 0 schemas huerfanos.

#### Commits

- `docs(m1): alinea el orden de required de SocioOut con el contrato`
- `docs(log): registra la correccion de la medicion de paths y los hallazgos de summary y example`

#### Pendientes que siguen abiertos

1. **`summary` difiere en 7 de las 12 operaciones de M1.** Prosa, sin efecto funcional. El mismo desajuste de descripciones se repite en M2 a M5.
2. **11 responses 200/201 de M1 sin `example` en el vault**, contra 30 responses de error que si lo tienen.
3. **`additionalProperties: false` ausente del Swagger** en los 6 cuerpos de M1, y en los que se agreguen en M2 a M5. Aceptado como limitacion del generador.
4. **Los mismos defectos de tipo `integer` en parametros de M2 a M5**, y las divergencias de propiedades ya documentadas en SCRUM-11e.
5. **Dos convenciones distintas de base path entre codigo y vault.** No es un defecto, pero conviene fijar una sola para no volver a medir mal: hoy el codigo incluye `/api/v1` en los paths y el vault lo declara en `servers`.
6. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no esta versionado. Sigue siendo decision pendiente de Gonzalo.
7. **Sin validar: `foto_url` no se valida como URL** en ni el codigo ni el contrato. Solo `@IsString()`. Por decision de Gonzalo no se agrega `@IsUrl()`, porque rechazaria payloads que hoy pasan.

### Semana 8 · SCRUM-11h — Cierre de naming, summary, examples y additionalProperties de M1

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **El nombre de la clase TypeScript se filtra al documento, y por eso el naming era el hueco mas relevante de los que quedaban.** `export class SocioOutDto` produce `components.schemas.SocioOutDto` y un `$ref` a `#/components/schemas/SocioOutDto`, mientras el vault lo llama `SocioOut`. No era solo cosmetico: de ahi salen los nombres de clase del cliente generado. Se renombran las nueve clases de M1 para que coincidan con el contrato, en **98 referencias** sobre 22 archivos:

   | codigo | vault | archivo |
   | --- | --- | --- |
   | `UsuarioOutDto` | `UsuarioOut` | sin cambio |
   | `SocioOutDto` | `SocioOut` | sin cambio |
   | `MembresiaOutDto` | `MembresiaOut` | sin cambio |
   | `MembresiaPatchDto` | `MembresiaPatch` | sin cambio |
   | `CrearUsuarioDto` | `UsuarioIn` | `git mv` |
   | `CrearSocioDto` | `SocioIn` | `git mv` |
   | `CrearMembresiaDto` | `MembresiaIn` | `git mv` |
   | `ModificarUsuarioDto` | `UsuarioPatch` | `git mv` |
   | `ModificarSocioDto` | `SocioPatch` | `git mv` |

   Los cuatro primeros solo perdian el sufijo `Dto` y el nombre quedaba bueno. Los cinco siguientes cambian el concepto: `CrearUsuarioDto` pasa a llamarse `UsuarioIn`. Eso tiene un costo explicito, y se acepta: el proyecto tiene 7 clases `Crear*` y 2 `Modificar*` sobre 29 DTOs, y el vault no usa ninguno de esos prefijos en ningun schema, o sea que el prefijo es convencion del codigo y no requisito del contrato. Renombrarlos deja a M1 como el unico modulo con nombres `*In`/`*Patch` frente a M2 a M5, que conservan `Crear*Dto`. Se priorizo que el contrato, que es la fuente de verdad, se cumpla sin excepciones.

2. **La clase de error tambien diverge de nombre, y vive fuera de M1.** El vault la llama `Problem` y el codigo `ProblemDetailsDto`. Se renombra a `Problem` en `commons/swagger/`, con `git mv` de `problem-details.dto.ts` a `problem.dto.ts`. Esto **toca controladores de M2 y M3** y es una excepcion consciente a la regla de no salir de M1: son 19 referencias (3 en `commons`, 6 en M1, 4 en M2, 6 en M3) de un unico schema compartido, y sin tocarlo M1 no podia llegar a cero divergencias de naming. La alternativa —dejarlo— era registrar la excepcion para siempre. Se verifico que `Problem` no choca con el tipo global homonimo de `lib.dom`: compila sin error porque la clase es de alcance de modulo y lo sombrea.

3. **Los `git mv` son cosmeticos y se hacen igual.** Los nombres de archivo nunca llegan al documento, pero dejar `export class UsuarioIn` adentro de `crear-usuario.dto.ts` desorienta a quien lea el modulo despues. Git los detecta como `R100`, o sea que el contenido no cambio mas alla del nombre de la clase.

4. **Los 7 `summary` de M1 ahora coinciden con el vault.** `POST /usuarios` pasa de "Alta de usuario (perfil EXTERNO/RECEPCION/GERENTE)" a "Registrar usuario"; `GET /usuarios/{id}` de "Usuario por id (sin datos de contrasena)" a "Obtener usuario por id"; `PATCH /usuarios/{id}` de "Actualiza solo los campos presentes" a "Modificar parcialmente un usuario"; `GET /socios/{socio_id}` de "Socio por id" a "Obtener socio por id"; `PATCH /socios/{socio_id}` de "Modifica la sede de origen" a "Modificar parcialmente un socio"; `DELETE /socios/{socio_id}` de "Deja de ser socio (usuario vuelve a EXTERNO)" a "Dejar de ser socio"; y `GET /socios/{socio_id}/membresias` de "Membresia vigente del socio" a "Membresia actual del socio". Los cinco `summary` que ya coincidian no se tocan.

5. **`additionalProperties: false` deja de ser una limitacion aceptada del generador.** Se agrega `commons/swagger/mark-request-schemas.ts`, invocado en `main.ts` entre `createDocument` y `setup`. El helper recolecta los `$ref` alcanzados desde los `requestBody` de nivel superior y les pone `additionalProperties: false`. Marca los **11** request schemas que el documento contiene: los 6 de M1 y los 5 de M2 y M3. Es deliberadamente **no recursivo**: los `$ref` anidados apuntan a enums compartidos (`Rol`, `Plan`, `EstadoMembresia`) que el vault deja abiertos, y bajarlos habria cerrado schemas que el contrato no cierra. Tampoco toca schemas de respuesta, enums ni `Problem`. Con esto se cierra el punto que SCRUM-11f y SCRUM-11g veniran dejando como limitacion aceptada, y el `ValidationPipe` con `forbidNonWhitelisted: true` deja de rechazar en runtime algo que el documento no declaraba.

6. **Los 11 `example` de respuesta se agregan al vault, no al codigo.** Los 11 `200` y `201` de M1 (4 de `UsuarioOut`, 4 de `SocioOut`, 3 de `MembresiaOut`) incorporate `example` a nivel de media type. El vault ya tenia `example` a nivel de schema en `components.schemas`, o sea que la informacion existia de un lado y no del otro: estos son los que faltaban. El cambio es **puramente aditivo, 81 lineas agregadas y 0 quitadas**, verificado con una comprobacion de subsecuencia linea a linea contra el backup. Cada ejemplo se valido contra su schema: `required` completo, tipos, valores dentro de los enums, `format: email` y `format: date-time` parseables.

7. **Ejemplo de `fecha_alta` corregido en el codigo.** `socio-out.dto.ts` declaraba `example: '2026-09-15'` sobre un `fecha_alta!: Date`, cuyo `format` resuelto es `date-time`; la fecha sola no cumple el formato. Pasa a `'2026-09-15T00:00:00.000Z'`, que es el mismo estilo que ya usaba `membresia-out.dto.ts` en `fecha_inicio` y `fecha_fin`.

8. **`foto_url` sigue sin validarse como URL.** Se habia aprobado `@IsUrl()` y despues revertido; queda como estaba: solo `@IsString()`, sin `format: uri` en el contrato. Es la decision que mas veces se reviso en esta tanda y la version final es no tocarlo, porque rechazaria payloads que hoy pasan.

9. **Dos errores mios en la edicion del vault, los dos antes del commit.** El primero: el constructor del ejemplo de array generaba un `- ` por clave,-seven items sueltos en vez de un objeto de siete claves-, lo que rompio la indentacion. El segundo, en el mismo script: la linea `example:` se interpolaba sin `indent(14)` y quedaba en la columna 0. En los dos casos el archivo dejo de parsear, el validador lo detecto en la verificacion inmediata, se restauro del backup y se reejecuto. No llegaron a commitearse. Quedan registrados porque el patron se repite: en esta tanda los tres fallos que me costaron una revision extra fueron mios y ninguno del codigo.

#### Decisiones tomadas

1. **Renombrar las nueve, no solo las cuatro que solo perdian el sufijo.** Se acepta que M1 quede con convencion de naming distinta de M2 a M5 antes que dejar 5 de 9 divergentes. Decision de Gonzalo.
2. **Renombrar `ProblemDetailsDto` en `commons`, saliendo de M1.** Excepcion consciente: sin ella no se lograba el cero de naming en M1.
3. **Los examples van solo en el vault.** El codigo ya expone ejemplos por propiedad en los DTO y no se duplican a nivel de media type: la fuente de verdad es el contrato, y agregar el mismo ejemplo en dos lados risk la desincronizacion. Decision de Gonzalo.
4. **`additionalProperties` con post-proceso generico, no con decoradores por DTO.** Reutilizable tal cual en M4 y M5 sin tocar los DTO.
5. **No tocar `foto_url`, ni `servers`, ni `description`, ni la convencion de base path.** Cada uno evaluado y descartado por separado: `servers` duplicaria el prefijo y dejaria roto el `/docs`; `description` es prosa y el codigo ya la tiene en los decoradores; la base path son dos convenciones validas para lo mismo y unificarla exige tocar los 30 paths del vault, fuera de alcance.

#### Verificacion

- `npx tsc --noEmit -p tsconfig.json` y `npm run build` en verde. e2e: **49/49 en 5 specs**, identico a las cuatro entradas anteriores. Confirma que el rename de clases no cambio comportamiento: el nombre de clase no participa de la serializacion ni de la validacion, solo del nombre del schema.
- **Naming de M1: 10 de 10.** Los nueve schemas de M1 mas `Problem` existen en el documento con el nombre del contrato. Los once schemas con sufijo `Dto` que quedan (`AforoOutDto`, `ClaseOutDto`, `CrearClaseDto`, `CrearEsperaDto`, `CrearReservaClaseDto`, `CrearSedeDto`, `EsperaOutDto`, `IngresoInDto`, `IngresoOutDto`, `ReservaClaseOutDto`, `SedeOutDto`) son de M2 a M5 y no se tocaron.
- **Estructura de los 10 schemas de M1: 0 divergencias** de `required`, tipos, enums y restricciones. El comparador resuelve los `$ref` del vault a sus enums con nombre antes de comparar, porque el codigo emite el enum inline y el vault por `$ref`; los valores coinciden.
- **12 operaciones de M1: 0 divergencias de `summary` y 0 de `operationId`.** Antes de este commit eran 7 de `summary`.
- **`additionalProperties`: 11 request schemas** marcados en el codigo por el helper y declarados en el vault. Ninguno marcado de mas, y `Problem` sigue abierto.
- Vault: YAML parsea, 39 schemas, 11 bloques `example` agregados, 0 lineas quitadas, encoding preservado (CRLF, sin BOM, sin U+FFFD). Backup `pre-m1-closure.bak` de 91614 bytes, SHA256 `09E15898...`, intacto.
- `git diff`: 6 renames detectados como `R100` y 23 archivos modificados; revision manual de los tres controllers de M1, los nueve DTO, los tres services, los cinco controllers de M2 y M3, `problem-json.ts`, `main.ts` y `m1.e2e-spec.ts`.

#### Commits

- `refactor(m1): alinea los nombres de los schemas y los summary de M1 con el contrato`
- `docs(log): registra el cierre de naming, summary, examples y additionalProperties de M1`

Van en dos commits y no en tres por una razon concreta: los renombres de clase y los `summary` viven en los mismos archivos (`usuarios.controller.ts`, `socios.controller.ts`, `membresias.controller.ts`), asi que separarlos exigiria un stage interactivo por linea. Y los 11 `example` del vault **no van en ningun commit**: el contrato esta fuera del repo, asi que ese cambio viaja solo con el backup `pre-m1-closure.bak` como referencia.

#### Pendientes que siguen abiertos

1. **Once schemas de M2 a M5 conservan el sufijo `Dto`** (106 referencias). El rename de M1 deja esos cuatro modulos con la convencion anterior; alinearlos es trabajo de cada modulo, no de M1.
2. **`summary` difiere en 15 operaciones de M2 y M3** (sedes, clases, reservas-clases, esperas-clases), con el mismo desajuste de prosa que se acaba de corregir en M1.
3. **CERRADO en SCRUM-11i: los `example` a nivel de schema del vault usaban fecha sola donde el `format` es `date-time`**, en `SocioOut.fecha_alta`, `MembresiaOut.fecha_inicio` y `MembresiaOut.fecha_fin`. Era una inconsistencia interna del vault, anterior a este trabajo, y no se corrigio en esta entrada por quedar fuera de lo aprobado. Los 11 examples nuevos si usaban ISO completo.
4. **M4 tiene cuatro request schemas en el vault sin implementacion**: `CanchaIn`, `CanchaPatch`, `PagoIn` y `ReservaCanchaIn`. El post-proceso los cubrira solo cuando exista el codigo que los referencie.
5. **Dos convenciones distintas de base path entre codigo y vault.** No es un defecto, pero conviene fijar una sola: hoy el codigo incluye `/api/v1` en los paths y el vault lo declara en `servers`.
6. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no esta versionado. Sigue siendo decision pendiente de Gonzalo.
7. **Sin validar: `foto_url` no se valida como URL** en ni el codigo ni el contrato. Solo `@IsString()`. Decision de Gonzalo, revertida dos veces.
8. **El comparador contrato/codigo no esta versionado.** Toda esta medicion corrio sobre scripts `node` ad-hoc en el directorio temporal. No hay forma de reproducir un "0" de forma independiente ni de detectarle regresiones, y esta tanda demostro el costo: dos de los tres fallos fueron del propio comparador. Deberia vivir en el repo como un script o test antes de auditar M2.

### Semana 8 · SCRUM-11i - Corrección de los ejemplos de fecha de M1

**Fecha:** 28/09/2026 · **Rama:** `main`

#### Actividades

1. **El pendiente 3 de SCRUM-11h era una incoherencia real del vault, no un detalle de estilo.** Los `example` a nivel de schema de `SocioOut` y `MembresiaOut` declaraban `fecha_alta`, `fecha_inicio` y `fecha_fin` con fecha sola (`"2026-09-15"` y `"2026-10-15"`) mientras esas mismas propiedades declaran `format: date-time` en las lineas 1769, 1831 y 1834. El contrato se contradice a sí mismo: el ejemplo no cumple el formato que el propio schema exige. Son 3 valores, en las lineas 1781, 1841 y 1842.

2. **La auditoría confirma que son exactamente 3 y que el resto de las fechas del vault están bien.** Se recorrieron `components.schemas` (example a nivel de schema y example por propiedad), los `requestBody` y `responses` de cada operación, los parámetros de operación, `components.parameters` y `components.responses`. Resultado: 3 problemas, todos los de arriba. Los otros 10 ejemplos con fecha del vault son legítimos: 5 son `format: date` con fecha sola, que es lo que corresponde (los parámetros de query `fecha` de reservas y `desde`/`hasta` de ingresos), y 5 son `format: date-time` con ISO completo de M2 a M4.

3. **`Z` y `-03:00` no son dos formas de escribir lo mismo: son instantes con 3 horas de diferencia.** Este es el punto que ordenó el resto de la ronda. `2026-09-15T00:00:00Z` son las 21:00 del 14 de septiembre en Córdoba. El código usaba `Z` en los tres DTO de M1 y el vault usaba `-03:00` en los ejemplos de M2 a M4, así que antes de tocar nada había dos notaciones conviviendo. Gonzalo eligió la de Argentina, `-03:00`, porque el gimnasio está en el país. Para `fecha_alta` y `fecha_inicio`, que son campos de fecha y no de instante, las 00:00 tienen que ser medianoche local: con `Z` habrían apuntado al día anterior.

4. **Aplicar el offset solo a las 3 líneas del defecto habría creado una incoherencia nueva.** Si solo se tocaran esas 3, el mismo campo `SocioOut.fecha_alta` quedaría con `T00:00:00-03:00` en el example de schema y `T00:00:00.000Z` en los 4 examples de media type, o sea dos instantes distintos para el mismo campo dentro del mismo schema. Se aplica entonces a los **16 valores de fecha de M1**: 3 del example de schema, 10 de los examples de media type y 3 de los DTO. Sin milisegundos, que es el estilo que ya usaba el vault en M2 y M4.

5. **Se unifica también el juego de fechas, no solo la notación.** El vault usaba `2026-09-15` y `2026-10-15`; el código usaba `2026-09-20T12:00:00.000Z` y `2026-10-20T12:00:00.000Z` para membresía. Los dos eran date-time válidos, o sea que no era un defecto, pero quedaban dos juegos de fechas distintos entre el contrato y el código. Manda el del vault: `2026-09-15T00:00:00-03:00` para `fecha_alta` y `fecha_inicio`, y `2026-10-15T00:00:00-03:00` para `fecha_fin`. En `membresia-out.dto.ts` eso cambia además el día, de 09-20/10-20 a 09-15/10-15.

6. **13 líneas del vault, 3 del código.** En el vault, 10 de los examples de media type y 3 de los examples de schema. Las sustituciones se hicieron sobre cadenas exactas y con la cantidad de ocurrencias verificada antes de escribir: `"2026-09-15T00:00:00.000Z"` 7 veces, `"2026-10-15T00:00:00.000Z"` 3 veces, `"2026-09-15"` 2 veces y `"2026-10-15"` 1 vez. Los dos únicos `Z` que quedan en el vault son los de `fecha_pago` de M3, con milisegundos, y no se tocan.

7. **Dos errores míos en esta ronda, los dos en las herramientas de medición y ninguno en el resultado.** El primero: el sumario de la auditoría imprimía `TOTAL 0` cuando la sección de arriba había detectado 3. El agregador anteponía la categoría al arreglo y después filtraba por la posición 0, que ya no era la categoría; el filtro no podía encontrar nada. Si se hubiera confiado en ese total, se habría cerrado el punto dando por hecho que no había nada que corregir. El segundo: el comparador de operaciones reportaba las 12 operaciones de M1 como "ausentes en el código" porque buscaba `/usuarios` en el documento generado, que los emite con el prefijo `/api/v1`. Ninguno de los dos tocó un archivo: los dos se detectaron porque la salida se contrastó con la sección que sí funcionaba. Este comparador tampoco resolvía los `$ref` del vault a sus enums con nombre antes de comparar, como hacía el de SCRUM-11h, y por eso marcó 4 schemas de M1 como divergentes: en los cuatro la diferencia es que el vault usa `$ref: Plan` y el código el enum inline, con los mismos valores. Se comprobó que esos 4 ya divergían antes de esta ronda comparando el backup contra el vault actual: 0 schemas cambiaron de estructura.

#### Decisiones tomadas

1. **`-03:00` en los 16 valores de M1, no solo en los 3 del defecto.** Aceptar el offset argentino obligaba a corregir también los 10 examples de media type y los 3 DTO; hacerlo era preferible a dejar un campo con dos instantes distintos. Decisión de Gonzalo.
2. **Manda el juego de fechas del vault, no el del código.** El contrato es la fuente de verdad, igual que en el resto de las decisiones de esta tanda.
3. **Sin milisegundos.** `T00:00:00-03:00` y no `T00:00:00.000-03:00`: para un example que representa medianoche el subcomponente de milisegundos es ruido, y el vault ya usaba el estilo corto en M2 y M4.
4. **No se normalizan los ejemplos de M2 a M4.** Quedan en `-03:00` con el juego de fechas propio de cada módulo. Cambiarlos sería trabajo de cada módulo, no de M1.

#### Verificación

- `npx tsc --noEmit -p tsconfig.json` y `npm run build` en verde. e2e: **49/49 en 5 specs**, sexta entrada consecutiva con el mismo resultado. Los examples no participan de la serialización ni de la validación, así que era esperable; se corrieron igual.
- **Auditoría de formatos: 0 problemas en el vault y 0 en el código**, con cobertura de los 6 lugares donde puede aparecer un `example`: a nivel de schema, por propiedad, media type de request y response, parámetro de operación, `components.parameters` y `components.responses`. Antes de la ronda eran 3 y 0.
- **Los 16 valores de fecha de M1 usan `-03:00`, 0 usan `Z`.** Verificado con regex de date-time sobre todo el vault, sin heurística por nombre de campo: los únicos 2 `Z` que quedan en el documento son los `fecha_pago` de M3.
- **12 operaciones de M1: 0 divergencias de `summary` y 0 de `operationId`.** Y **9 de 9** schemas de M1 nombrados como el contrato.
- **0 schemas cambiaron de estructura** entre el backup y el vault actual. El único cambio del vault es de valor, dentro de `example`.
- Vault: YAML parsea, 39 schemas, **13 líneas modificadas, 0 agregadas y 0 quitadas**, encoding preservado (CRLF, sin BOM, sin LF sueltos), 94754 bytes contra 94699 del backup. Backup `pre-11i.bak` de 94699 bytes, SHA256 `4F91C58B...`, intacto.
- `git diff`: 2 archivos, 3 inserciones y 3 borrados, los tres dentro de cadenas de `example` en `@ApiProperty`.

#### Commits

- `docs(m1): unifica los ejemplos de fecha de M1 en la zona horaria de Argentina`
- `docs(log): registra la corrección de los ejemplos de fecha de M1`

Los **13 cambios del vault no van en ningún commit**, igual que los 11 examples de SCRUM-11h: el contrato está fuera del repo. Quedan solo en el backup `pre-11i.bak` y en este registro.

#### Pendientes que siguen abiertos

1. **Once schemas de M2 a M5 conservan el sufijo `Dto`** (106 referencias). El rename de M1 deja esos cuatro módulos con la convención anterior; alinearlos es trabajo de cada módulo.
2. **`summary` difiere en 15 operaciones de M2 y M3** (sedes, clases, reservas-clases, esperas-clases), con el mismo desajuste de prosa que se corrige acá.
3. **M4 tiene cuatro request schemas en el vault sin implementación**: `CanchaIn`, `CanchaPatch`, `PagoIn` y `ReservaCanchaIn`. El post-proceso los cubrirá solo cuando exista el código que los referencie.
4. **El vault usa `$ref` a enums con nombre y el código los emite inline.** No es un defecto: los valores coinciden en los cuatro casos de M1 revisados. Pero hace que un comparador ingenuo reporte divergencias donde no las hay, y por eso el de SCRUM-11h resolvía los `$ref` antes de comparar. Esa resolución debería vivir en el comparador, no en el schema.
5. **Dos convenciones distintas de base path entre código y vault.** Hoy el código incluye `/api/v1` en los paths y el vault lo declara en `servers`.
6. **El contrato vive fuera del repo** (`TFI FitZone - OpenAPI.yaml` y `TFI FitZone - Plan de Trabajo M3.md`, en el vault). Es la fuente de verdad de la API y no está versionado. Sigue siendo decisión pendiente de Gonzalo.
7. **Sin validar: `foto_url` no se valida como URL** en ni el código ni el contrato. Solo `@IsString()`. Decisión de Gonzalo, revertida dos veces.
8. **El comparador contrato/código no está versionado.** Esta ronda lo confirma otra vez: dos de los tres fallos fueron del propio comparador, uno de ellos un total que reportaba 0 cuando había 3. Debería vivir en el repo como un script o test antes de auditar M2.

## Unidad II - Auditoría del módulo 2

### Semana 9 - SCRUM-11j - Cierre de M2: dos endpoints faltantes, naming y VENCIDA

M2 estaba implementado, commiteado y con e2e en verde, pero **no coincidía con el contrato**. El plan declaraba 5 endpoints y el contrato tiene 7: faltaban `GET /ingresos` y `GET /ingresos/{ingreso_id}`. Además arrastraba la convención de naming anterior (sufijo `Dto`) y textos que describían "membresía ACTIVA" cuando la regla real es de vigencia.

**Trabajo sobre el código**

- Agregados `GET /ingresos` y `GET /ingresos/{ingreso_id}`: filtros de `sede_id`, `usuario_id`, `fecha` y `dentro`, más `page`/`per_page`, con orden estable `fecha_hora_ingreso desc, id desc` para que la paginación no repita ni pierda filas.
- `fecha` se resuelve con `rangoDelDia()` (helper nuevo en `commons/fechas.ts`) en hora local de la sede (`-03:00`), de media noche a media noche con extremo superior exclusivo. `dentro=true` filtra por `fecha_hora_egreso IS NULL`; `dentro=false` no filtra, porque el contrato solo define el caso `true`.
- Renombrados los DTO de M2 para coincidir con los nombres del vault, sin sufijo `Dto`. Esto resuelve el pendiente 1 de SCRUM-11i para M2.
- Ajustados `summary`, `tags`, tipos de parámetro y ejemplos de Swagger. Resuelve el pendiente 2 de SCRUM-11i para M2.
- `Problem.errors` del `ValidationPipe` documentado en el `ProblemDetails` y el filtro de problemas centralizado.

**Cierre de `VENCIDA` (el hallazgo de fondo)**

`PATCH /socios/{id}/membresias` aceptaba `{"estado": "VENCIDA"}`. Como `estaVigente` no mira el estado sino la fecha, esa membresía se podía escribir con `fecha_fin` **futura** y quedaba vigente: el socio pasaba el control de ingreso.

Se cerró en la frontera, que es el único lugar donde el sistema controla la entrada: `MembresiaPatch.estado` ahora acepta solo `ACTIVA` y `SUSPENDIDA`. `VENCIDA` queda reservado al cron, que (verificado en el repositorio) solo lo aplica cuando `fecha_fin` ya pasó. Con el enum cerrado, **todo `VENCIDA` viene del cron y por lo tanto tiene la fecha vencida por construcción**: la regla de la fecha queda Sound sin tocarla.

Se descartó la alternativa de validar en `estaVigente`, porque con el enum abierto el sistema seguía aceptando un estado que contradice su propia regla.

También se unificó el vocabulario: el 403 de registro de ingreso decía "membresía ACTIVA" y ahora dice "membresía vigente", igual que el contrato. El texto del vault pasó de "membresía ACTIVA" a la regla de vigencia en los tres lugares que lo repetían.

**Verificación**

- `npx tsc --noEmit` y `npm run build`: en verde.
- e2e local y contra Supabase compartida: **58/58** en ambas. Conteos de las 7 tablas idénticos antes y después (`Sede=3`, `Socio=3`, `Usuario=6`, `Ingreso=3`, `Membresia=3`, `Pago=3`, `Clase=4`).
- Comparador contra el YAML del vault: **M1 = 0 diferencias, M2 = 0 diferencias**. El único test en rojo es el global, por diferencias que pertenecen a M3.
- 2 tests nuevos en `m1.e2e-spec.ts`: `VENCIDA` devuelve `422` y deja la fila intacta; suspender y reactivar sigue funcionando.
- 1 detalle verificado y descartado como bug: los dos `404` de `membresias.service.ts` dicen "membresía activa", pero `buscarPorSocioId` consulta `where: { socio_id }` **sin filtro de estado**, así que una `VENCIDA` no vencida se devuelve con `200`. Es redacción, no lógica.

**Vault (fuera de git)**

- `TFI FitZone - OpenAPI.yaml`: enum de `MembresiaPatch.estado` reducido a `[ACTIVA, SUSPENDIDA]`, más los textos de vigencia. Backup `pre-b1-20260929-182039.bak` de 94754 bytes. El vault quedó en 94722 bytes, 30 paths, 39 schemas, 22 responses, encoding preservado (CRLF, sin LF sueltos, 0 caracteres corruptos).
- `TFI FitZone - Plan de Trabajo M2.md`: de 5 a 7 endpoints, 4 path params corregidos (`{ingresoId}`/`{sedeId}` → `{ingreso_id}`/`{sede_id}`), "contrato congelado" eliminado, y el punto 7.2 corregido: el ADR de M2 va al vault, no a `docs/`, porque los ADR del proyecto viven en `Definicion Tecnica.md` junto a ADR-05/06/07.
- `TFI FitZone - Definicion Tecnica.md`: **ADR-08** (regla de vigencia de membresía y expiración por cron) y **ADR-09** (acceso entre módulos por puerto con inyección opcional, fail-closed). Nueva sección 7 con la **deuda técnica conocida** (autenticación y roles, coherencia de ingresos offline, canal de email de M3, QR/TOTP, contrato fuera del repo, códigos `400` declarados).

#### Commits

- `feat(m2): completa sedes e ingresos alineado con el contrato`
- `fix(m2): cierra VENCIDA en el contrato de entrada de membresia`

Los cambios del vault **no van en ningún commit**: el contrato y los planes viven en el vault de Obsidian, fuera del repositorio. Quedan solo en los backups y en este registro.

#### Pendientes que siguen abiertos

1. **M3 arrastra los mismos dos problemas que acabamos de corregir en M2**, y además los agrava: sus DTO se llaman `CrearClaseDto`, `ClaseOutDto`, `CrearReservaClaseDto`, `ReservaClaseOutDto`, `CrearEsperaDto` y `EsperaOutDto`, cuando el contrato pide `ClaseIn`, `ClaseOut`, `ReservaClaseIn`, `ReservaClaseOut`, `EsperaIn` y `EsperaOut`. El vault además declara `EstadoEspera` y `EstadoReservaClase`, que **no existen como enum en el código**. Sus 14 endpoints sí están implementados y los e2e pasan; lo que falta es la alineación.
2. **`summary` difiere en 5 operaciones de M3** (clases, reservas-clases, esperas-clases), el mismo desajuste de prosa que se acaba de corregir en M2.
3. **El canal de email de la lista de espera de M3 no está implementado.** El plan lo pide (decisiones 9 y 10, tarea 7 del Bloque 3), pero `nodemailer` no está en `package.json` y no existe la carpeta `notifications/`. El código usa `observers/` con el patrón Observer clásico, que cumple la misma idea con otra forma. Tampoco existe el puerto para obtener el email del socio: los tres puertos actuales son pago, vigencia de membresía y existencia de sede.
4. **M4 tiene cuatro request schemas en el vault sin implementación**: `CanchaIn`, `CanchaPatch`, `PagoIn` y `ReservaCanchaIn`.
5. **El comparador sigue sin versionarse**, confirmado por tercera ronda. Como no hay evidencia en el repo, la salida se vuelca como texto en esta entrada.
6. **Sin validar: `foto_url` no se valida como URL.** Decisión de Gonzalo, revertida dos veces.
7. **El contrato vive fuera del repo.** Es la fuente de verdad de la API y no está versionado. Sigue siendo decisión pendiente de Gonzalo.



---

## Unidad II - Auditoría del módulo 3

### Semana 9 - SCRUM-11k - Cierre de M3: naming, Swagger, códigos de estado y canal de email

Cierra los puntos 1, 2 y 3 que quedaron abiertos en la entrada de M2.

#### 3A - Naming de los DTO

Se renombraron los DTO para que coincidan con los `components.schemas` del contrato:

| Antes                  | Ahora             |
| ---------------------- | ----------------- |
| `CrearClaseDto`        | `ClaseIn`         |
| `ClaseOutDto`          | `ClaseOut`        |
| `CrearReservaClaseDto` | `ReservaClaseIn`  |
| `ReservaClaseOutDto`   | `ReservaClaseOut` |
| `CrearEsperaDto`       | `EsperaIn`        |
| `EsperaOutDto`         | `EsperaOut`       |

Los archivos de `dtos/` se renombraron con `git mv`, así que el historial sigue al
archivo y no aparece como borrado más alta.

Sobre `EstadoEspera` y `EstadoReservaClase`: el contrato los declara como schemas
nombrados, pero **el código no los tiene como enum**, igual que ya pasaba en M1 con
`Rol`, `Plan` y `EstadoMembresia`. Se mantuvo ese criterio y se los agregó al
comparador local como schemas equivalentes. En la API los valores siguen siendo los
del contrato, verificado operación por operación.

#### 3B - Swagger contra el contrato

- `type: 'integer'` en los campos numéricos de los seis DTO y en los cinco query DTO
  de paginación y filtros, y en todos los `@ApiParam` de path.
- `format: 'date-time'` en `horario` de `ClaseIn` y `ClaseOut`.
- Los 14 `summary` quedaron con el texto del contrato.
- `GET /clases/{clase_id}/reservas` y `GET /clases/{clase_id}/espera` se movieron de
  `ReservasClasesController` y `EsperasClasesController` a `ClasesController`.

Lo del movimiento merece explicación porque no era cosmético. El contrato agrupa esas
dos operaciones bajo el tag `clases`, no bajo el de reservas ni el de esperas. Con
`@ApiTags` a nivel de método, `@nestjs/swagger` **suma** el tag del controller con el del
método: se emitía `reservas-clases, clases` y el comparador marcaba diferencia. Sacar el
tag del controller tampoco servía, porque con `autoTagControllers` (activo por defecto)
la librería deriva uno del nombre de la clase y aparecía `ReservasClases, reservas-clases`.
La única forma de dejar un único tag era alojar la operación en un controller cuyo tag
de clase ya fuera `clases`, que es lo que hacen ahora. Son rutas `/clases/:id/...`: son
vistas de la clase, y el contrato lo refleja así.

La ruta y el comportamiento no cambian, solo el controller que las atiende. Los e2e de
`/clases/{id}/reservas` y `/clases/{id}/espera` siguen pasando sin tocarlos.

#### 3C - Códigos de estado

Las ventanas temporales ya devolvían 409 y no hubo que cambiar el dominio: la ventana de
48 h para reservar y la de 2 h para cancelar lanzan `HttpStatus.CONFLICT`, igual que el
resto de los conflictos (14 casos en total entre los tres servicios). El 422 queda
reservado para el `ValidationPipe` global, y no hay ningún `UNPROCESSABLE_ENTITY`
emitido a mano en M3. Se verificó que en el documento ninguna de esas respuestas fuera
422.

#### Canal de email de la lista de espera

Implementado como **observer adicional** en la carpeta `observers/` que el código ya
usaba, y no como la carpeta `notifications/` del plan. La decisión es de Gonzalo: si el
código ya tiene `observers/` con el patrón Observer clásico, gana el código y se actualiza
el plan. El resultado cumple lo mismo que pedía el plan:

- `observers/cupo-liberado.observer.ts`: interfaz `CupoLiberadoObserver`.
- `observers/email-cupo-liberado.observer.ts`: nuevo canal con Nodemailer.
- La cadena en `onModuleInit` queda `[NotificarSociosEsperaObserver, EmailCupoLiberadoObserver]`.
- `ConsultaSocioPort.obtenerEmail(socioId)` en `commons/socio/`, implementado por
  `ConsultaSocioAdapter` en M1 y exportado por su `@Global()`, siguiendo el mismo patrón
  que `SEDE_VALIDATION_PORT`.
- `nodemailer` y `@types/nodemailer` agregados a `package.json`.
- `.env.example` con `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
  `MAIL_FROM` y `ETHEREAL`.

**Una carrera que hubo que evitar.** El `CupoLiberadoSubject` despacha a los observers
con `Promise.all`, o sea en paralelo. El método `buscarEnEsperaPorClase` filtra por
`estado: 'EN_ESPERA'`, y es justamente el observer de estado el que los pasa a
`NOTIFICADO`. Si el canal de email hubiera usado ese método, según cuál de los dos
terminara primero se habría quedado sin destinatarios y el aviso no se enviaba nunca.
Por eso se agregó `listarSociosEnEsperaPorClase(claseId)`, que devuelve la **cola viva**
(todo lo que no está CANCELADO: EN_ESPERA y NOTIFICADO) y por lo tanto da el mismo
resultado antes o después del cambio de estado. Es la semántica que ya pedía el plan, y
acá queda como la razón de fondo.

El modo de envío se resuelve una vez por proceso, en este orden: con `SMTP_HOST`,
`SMTP_USER` y `SMTP_PASS` el envío es real; con `ETHEREAL=true` usa `createTestAccount()`
y loguea la URL de vista previa con `getTestMessageUrl`; sin ninguno de los dos solo
loguea y **no sale a la red**. Ese último modo no es un atajo: el e2e de M3 tiene un caso
"clase llena → socio en espera → cancelación dispara Observer → confirmación first-come",
así que sin este corte el e2e intentaría crear una cuenta de Ethereal en cada corrida.

#### Evidencia

- `npx tsc --noEmit -p tsconfig.json`: OK.
- `npm run build`: OK.
- `npx vitest run --config vitest.e2e.config.ts`: **58/58** en 5 archivos.
- Comparador del contrato: **M3 = 0 diferencias** (28/28). Antes de este trabajo M3
  arrastraba 81.
- La cadena de observers se verificó con un test temporal contra la base local:
  `[NotificarSociosEsperaObserver, EmailCupoLiberadoObserver]`, con el aviso resolviendo
  destinatarios por el puerto de M1 y sin tocar la red. El test era de andamiaje y se
  borró; no queda en el repo.

#### Pendientes que siguen abiertos

1. **M4 tiene cuatro request schemas en el vault sin implementación**: `CanchaIn`,
   `CanchaPatch`, `PagoIn` y `ReservaCanchaIn`.
2. **El comparador sigue sin versionarse**, confirmado por cuarta ronda. Como no hay
   evidencia en el repo, la salida se vuelca como texto en esta entrada.
3. **Sin validar: `foto_url` no se valida como URL.** Decisión de Gonzalo, revertida dos veces.
4. **El contrato vive fuera del repo.** Es la fuente de verdad de la API y no está
   versionado. Sigue siendo decisión pendiente de Gonzalo.
5. **M3 no tiene tests unitarios.** `npm test` sigue siendo un stub y el único runner de
   pruebas es el e2e. El canal de email quedó verificado de forma puntual, no con una
   prueba permanente en el repo.
---

## Unidad II — Módulo 4: Canchas Deportivas (RF-09/RF-12) · Santino

### Semana 6 · SCRUM-11c — Bloque 1: Canchas (RF-09/RNF-04)

#### Actividades

1. **CRUD de canchas — Santino**
   - `CanchaRepository` con Prisma (`repositories/prisma/prisma-cancha.repository.ts`), DI por token string (`CANCHA_REPOSITORY`), y `CanchasService`/`CanchasController` inyectando `SEDE_VALIDATION_PORT` del Bloque 0 para validar la sede antes de crear una cancha.
   - Endpoints: `GET /sedes/{sedeId}/canchas` (filtro `estado` opcional, **incluye** las no operativas, RF-12) · `POST /sedes/{sedeId}/canchas` (201 + `Location`, 404 si la sede no existe) · `GET /canchas/{id}` · `PATCH /canchas/{id}` (costo y/o estado; pasar a `EN_MANTENIMIENTO` no toca ninguna `Reserva`).
   - `costo_por_hora` es `Decimal` en Prisma: mapeado a `number` con `.toNumber()` en el adaptador.
   - Verificado manualmente contra `/api/v1` real (no solo Swagger): filtro por estado, paginado, 404/422 con `problem+json`, y el caso RF-12 (`GET` sin filtro devuelve la cancha en mantenimiento, no la esconde).
   - `npx tsc --noEmit` y `npm run build` en verde.
   - [commit dd11243](https://github.com/GonzaloVila/FitZone-Sports/commit/dd11243)

---

### Semana 6 · SCRUM-11c — Bloque 2: Precio dinámico (RF-11)

#### Actividades

1. **Strategy de precio — Santino**
   - Cadena fija de 3 estrategias (`pricing/`), compuesta por `PricingStrategyFactory.cotizar(ctx)`: `StandardPricing` (tarifa externo, sin cambios) → `MemberDiscountPricing` (−15% si `socioVigente`, RN-03: socio con cuota vencida paga precio de externo) → `PeakHourPricing` (+20% si el turno se solapa con `[19:00, 21:00)` hora local de sede, ventana medio-abierta). Descuento y recargo son acumulables, no excluyentes.
   - Es lógica de dominio pura: `PricingContext` recibe los datos ya leídos (`costoBase`, `socioVigente`, `inicio`, `fin`); ningún archivo de `pricing/` toca Prisma ni consulta la base.
   - Comparación de horario contra `TIMEZONE_SEDE` con `Intl.DateTimeFormat` (`hourCycle: 'h23'`), no contra el `TZ` del proceso — evita que el resultado dependa de en qué máquina/huso corre el server.
   - Sin infraestructura de test unitario en el repo todavía (solo `vitest.e2e.config.ts`, que exige Docker): agregado `vitest.unit.config.ts` propio, sin Docker ni `.env.test`, y script `test:unit` en `package.json`.
   - 5 casos de `pricing-strategy.factory.spec.ts` en verde: externo 5000→5000 · socio 5000→4250 (ejemplo del contrato) · socio en pico→5100 · externo en pico→6000 · socio a las 21:00 en punto→4250 (confirma el límite medio-abierto, sin recargo).
   - **Nota:** el 20% de recargo por horario pico no sale del enunciado del caso — es una decisión del equipo, pendiente de confirmar con la cátedra.
   - [commit 4d537b3](https://github.com/GonzaloVila/FitZone-Sports/commit/4d537b3)

---

### Semana 6 - SCRUM-11c - Auditoria de integracion de los bloques 1 y 2

#### Actividades

1. **Merge de la rama de Santino y correccion de la alineacion con el contrato** - auditoria
   - Merge de `origin/santino` (estaba 35 commits atras de `main`) en el commit `c8e4bc5`. Los conflictos de `main.ts`, `app.module.ts` y `LOG.md` se resolvieron conservando M1-M3 y agregando el modulo de canchas.
   - La migracion `20260925020000_reserva_solapamiento_exclude` y el puerto `SEDE_VALIDATION_PORT` ya estaban en `main` (merge-base `2e499bc`): el Bloque 0 no venia en la rama.
   - Los DTO se renombraron a los nombres que declara el contrato: `CanchaIn`, `CanchaPatch` y `CanchaOut`. Se eliminaron `crear-cancha.dto.ts` y `modificar-cancha.dto.ts`.
   - Rutas y parametros en snake_case (`{sede_id}`, `{cancha_id}`) y `type: integer` en parametros y paginacion, como en M1-M3.
   - `ProblemDetailsDto` no existia en el codigo: el `import` estaba roto y se sustituyo por `Problem`, que es el schema de error (RFC 9457) que si existe.
   - `GET /sedes/{sede_id}/canchas` valida la sede por `SEDE_VALIDATION_PORT` y devuelve 404.
   - Se agrego `minimum: 0` explicito a `costo_por_hora` en `CanchaIn` y `CanchaPatch`: el comparador compara `minimum`, y el contrato lo declara en ambos.
   - Se quito el `422` del listado de canchas. El plan lo pedia, pero el contrato declara solo 200 y 404 en `GET /sedes/{sede_id}/canchas`; el contrato manda sobre el plan.
   - El 20% de recargo por pico quedo como constante nombrada con el comentario de que es decision del equipo pendiente de confirmar con la catedra, para que la deuda se vea en el codigo.

2. **Correccion del criterio de alcance del comparador** - auditoria
   - El alcance se decidia por "¿el codigo expone el tag?", asi que un modulo a medio implementar daba porImplementado lo que aun no existe: marcaba `GET /canchas/{cancha_id}/disponibilidad` como implementado y el comparador exigia sus respuestas y su schema `DisponibilidadEntrada`.
   - Ahora el alcance se decide por metodo + ruta reales que expone el documento de NestJS. El nombre del parametro se normaliza a `{}` solo para decidir el alcance, y la clave que se reporta sigue siendo la del contrato: una diferencia de naming se reporta en detalle en vez de sacar la operacion del alcance.
   - Al aparecen el prefijo aparecio un bug latente: `alcance.ts` pasaba `servers` por un helper que devuelve `undefined` para arrays, asi que el prefijo nunca se calculo y quedo vacio. Era codigo muerto, porque hasta ahora el prefijo no se usaba para nada. Corregido para que el documento de NestJS (rutas con `/api/v1` ya aplicado) y el contrato (prefijo en `servers[0].url`) se comparen en la misma base.
   - Efecto medido: de 38 a comparar / 9 pendientes a **37 a comparar / 10 pendientes**, y lo unico que sale del alcance es `GET /canchas/{cancha_id}/disponibilidad` con su schema `DisponibilidadEntrada`. El guard se escribio comparando conjuntos, no conteos, y se borro al terminar.

3. **Resultado de la verificacion** - auditoria
   - Comparador de contrato: **28/28**, 37 operaciones y 31 schemas comparados, 10 operaciones y 8 schemas fuera de alcance, **0 diferencias**.
   - E2E: **58/58** en 5 archivos.
   - Unitarios de la cadena de precios: **5/5**.
   - `npx tsc --noEmit` y `npm run build` en verde.
   - Las 2 diferencias de `minimum` y los 2 `schema-falta` de enum que quedaban (`TipoCancha`, `EstadoCancha`) se resolvieron asi: los `minimum` arreglando los DTO; los enums agregando las dos entradas a `PERMITIDAS`, igual que `Rol`, `Plan`, `EstadoMembresia`, `EstadoEspera` y `EstadoReservaClase`. Los enums siguen inline en el codigo por consistency con M1-M3.
   - Se verificó contra `/api/v1` real y no solo contra Swagger: `CanchaIn.costo_por_hora` aparece con `minimum: 0`, y el listado expone 200 y 404 y nada mas.
   - Dos aclaraciones para que no se relean despues como faltantes de M4, cuando son previas y vienen del contrato:
     - El contrato pone un `example` de objeto en cada schema `*Out` (`CanchaOut`, `SocioOut` y el resto), y el codigo no lo reproduce en ninguno: en todos los modulos los ejemplos van por campo, en el `@ApiProperty`. `CanchaOut` sigue la misma convencion que M1-M3.
     - Los 404 de canchas son en el contrato el mismo `$ref` compartido a `responses/NotFound` ("Recurso no encontrado (o dado de baja)"), y el codigo los describe por operacion ("La sede no existe", "La cancha no existe"). El comparador no compara `description` a proposito, porque el contrato redacta en prosa larga y el codigo en una linea.

#### Pendientes que siguen abiertos

1. **El comparador sigue sin versionarse.** `backend/contrato/` esta en `.gitignore`, asi que las correcciones de `alcance.ts` y las dos entradas de `PERMITIDAS` de esta ronda **no llegan al equipo por el repo**. Se reimplementan en la maquina de cada uno. Es el mismo pendiente que arrastra el LOG desde M1, y esta ronda lo vuelve a hacer presente.
2. **Bloque 3 sin empezar** (Santino): disponibilidad, grilla 08:00-22:00 con paso 60 y la paginacion acordada, `ReservaCanchaIn` con `usuario_id` obligatorio mas su entrada en `PERMITIDAS`, y el precio congelado en `precio_aplicado`. La `PricingStrategyFactory` todavia no se registra en `canchas.module.ts` a proposito: es la tarea 9 del Bloque 3, y registrarla ahora seria cablear algo que nadie consume.
3. **Bloque 4 sin empezar** (Santino): QA, reservas de clase, pagos y cierre.
4. **Deuda tecnica de M4, registrada en el plan:** validacion de horarios de la sede (en M4 solo se valida `fecha_hora_inicio < fecha_hora_fin`).
5. **Sin autenticacion ni roles en toda la API.** Es deuda de M1 que arrastra a M4: el contrato no versiona auth, y `usuario_id` en las reservas sigue siendo el unico control de pertenencia.

### Semana 9 - SCRUM-11l - Auditoria de fechas (TIMESTAMPTZ) y del orden de la lista de espera

#### Actividades

1. **Migracion de las once columnas de fecha a TIMESTAMPTZ** - auditoria
   - Las once columnas de fecha eran `TIMESTAMP(3)` sin zona. Prisma mapea `DateTime` a `timestamp(3)` y escribe los componentes UTC del instante, asi que lo almacenado ya era wall-clock UTC en una columna que declara no tener zona: el tipo miente sobre lo que los datos son.
   - Nada lo declaraba ni lo forzaba. No hay `SET TIME ZONE` en ninguna migracion, ni `TZ` en la configuracion, y produccion (Supabase en `sa-east-1`) y los tests (Postgres local) son dos entornos distintos confiando en el mismo default no declarado.
   - Eso ya habia forzado una decision de diseno. `20260925020000_reserva_solapamiento_exclude` uso `tsrange` y **no** `tstzrange` precisamente porque las columnas no tenian zona, y su propio comentario admite que con `tstzrange` PostgreSQL castearia usando el `TimeZone` de cada sesion. La invariante RN-02 (no solapamiento) dependia entonces de que toda sesion escribiera UTC, y eso vivia en un comentario y no en el esquema.
   - Con `TIMESTAMPTZ` el tipo pasa a declarar lo que los datos ya eran, y `tstzrange` pasa a ser correcto por construccion: los rangos se comparan por instante absoluto y no dependen de quien consulta.
   - El `SET TIME ZONE 'UTC'` al inicio de la migracion es lo que hace la conversion neutra. `ALTER ... TYPE` interpreta los valores existentes con el `TimeZone` de la sesion en curso; como lo almacenado es wall-clock UTC, fijar UTC deja los instantes intactos. Sin esa linea, los instantes se correrian en el offset de quien ejecutara la migracion.
   - `exq_reserva_turno` se dropea antes de tocar las columnas y se recrea con `tstzrange`: no se puede alterar la columna con la constraint de exclusion vigente.
   - `schema.prisma` lleva `@db.Timestamptz(3)` en las once columnas, alineado con el SQL. El cliente generado cambia solo la anotacion nativa: `DateTime` sigue siendo `Date`, asi que no cambio ninguna firma.
   - Verificado sobre una base de pruebas con las 8 migraciones aplicadas y datos sembrados con instantes reales: los ocho instantes de muestra se leen identicos antes y despues, un solapamiento real sigue rebotando, un turno contiguo se permite, `CANCELADA` sigue fuera del alcance, y bajo sesion en `America/Argentina/Buenos_Aires` el instante es el mismo. `prisma migrate diff` contra la base migrada: **no difference detected**.
   - [commit 455c357](https://github.com/GonzaloVila/FitZone-Sports/commit/455c357)

2. **Caracterizacion de `rangoDelDia` y unificacion de la zona horaria de la sede** - auditoria
   - `commons/fechas.ts` era el nucleo del filtro `fecha` de ingresos y no tenia **ningun** test.
   - La sede tenia dos representaciones distintas de la misma zona: offset fijo `-03:00` en `commons/fechas.ts` y `America/Argentina/Buenos_Aires` en el pricing de canchas. Podian divergir sin que nada lo detectara. Ahora `ZONA_SEDE` es la constante IANA y `pricing-constants` la reexporta.
   - El test de caracterizacion destapo un bug real: el DTO de `fecha` solo valida el formato (`^\d{4}-\d{2}-\d{2}$`), y `new Date('2026-02-30T00:00:00-03:00')` **no** es `NaN`: rueda solo a `2026-03-02`. El filtro `fecha` devolvia el dia siguiente al pedido, en silencio. `rangoDelDia` ahora rechaza un dia que no existe.
   - [commit fdc7178](https://github.com/GonzaloVila/FitZone-Sports/commit/fdc7178)

3. **Desempate del orden de la lista de espera** - auditoria
   - Los tres `orderBy` de espera ordenaban solo por `fecha_anotacion`, que es `TIMESTAMP(3)` y la genera la app con `new Date()`. Dos socios que se anotan en el mismo milisegundo empatan, y con `skip`/`take` eso hace que la paginacion repita una fila y saltee otra.
   - Se agrego `{ id: 'asc' }` como segundo criterio en los tres repos, siguiendo el criterio que ya aplicaba `Ingreso.listar` para el mismo problema.
   - El e2e fija la misma `fecha_anotacion` en las cuatro esperas **y** reescribe las filas en orden inverso al id, porque con solo el empate el test pasaba igual: un seq scan devuelve orden de heap, que coincide con el id. Verificado que falla sin el fix (`[220,219,218,217]`) y pasa con el.
   - Aclaracion importante: el cupo **no** lo decide este orden. `confirmarEsperaConLock` ya serializaba con `SELECT ... FOR UPDATE` sobre `Clase` y asignaba `fecha_confirmacion` despues del lock, asi que el first-come ya era determinista. Esto es determinismo de lectura y equidad en la notificacion, no una carrera de cupo.
   - [commit dcd2592](https://github.com/GonzaloVila/FitZone-Sports/commit/dcd2592)

4. **Invariante de una sola espera activa, cerrada en la base** - auditoria
   - `crear()` comprobaba con un `findFirst` que el socio no tuviera otra espera `EN_ESPERA`/`NOTIFICADO`, pero esa lectura y el INSERT posterior no son atomicos: dos peticiones simultaneas del mismo socio para la misma clase pueden pasar ambas el chequeo.
   - Se agrego el indice parcial unico `unq_espera_clase_socio_activa` sobre `(clase_id, socio_id) WHERE estado IN ('EN_ESPERA','NOTIFICADO')` y se tradujo el `P2002` a `ESPERA_EXISTENTE`, que el service ya mapeaba a 409. Es el mismo esquema que ya usan `unq_reserva_clase_socio_activa` e `ingreso_usuario_abierto_unq`; SQL crudo porque Prisma 6.19.3 no modela indices parciales.
   - Cubre solo los estados activos, asi que un socio que dio de baja y vuelve a anotarse puede reinscribirse. Eso lo cubre un e2e.
   - El e2e fuerza el hueco de forma determinista, insertando la segunda espera por Prisma y salteando el chequeo de application. **Con N requests en paralelo la carrera no se reproduce en forma fiable**: el `findFirst` suele alcanzar a atrapar el segundo POST y el test pasaria aunque la constraint no existiera. Se verifico que falla al dropear el indice.
   - [commit 1e351fc](https://github.com/GonzaloVila/FitZone-Sports/commit/1e351fc)

5. **Resultado de la verificacion** - auditoria
   - E2E: **61/61** en 5 archivos (contra la base ya migrada a `timestamptz`).
   - Unitarios: **10/10** (los 5 de la cadena de precios mas 5 nuevos de `fechas.spec.ts`).
   - Comparador de contrato: **28/28**, **0 diferencias**.
   - `npx tsc --noEmit` y `npm run build` en verde. `npx prisma validate` y `npx prisma format` aplicados.
   - Los e2e de ingresos por `fecha` y de solapamiento de reservas se ejecutaron contra la base con `timestamptz` y pasaron sin cambios en el codigo, que es la prueba de que la conversion fue neutra.

#### Pendientes que siguen abiertos

1. **Las dos migraciones de esta ronda quedaron aplicadas en produccion** (Supabase `sa-east-1`) el 30-09-2026, con ventana y respaldo previo. Antes de aplicar se tomo un `pg_dump --format=custom --schema=public` de la base, verificado con `pg_restore --list` (contiene las 10 tablas con datos + `_prisma_migrations`).
   - Baseline de 31 instantes leidos antes y despues: **byte-identicos**, sin ningun corrimiento.
   - `20260928000000_espera_clase_socio_activa_unq` y `20260929000000_fechas_timestamptz` aplicadas; `prisma migrate status` queda en **up to date** y `migrate diff` contra produccion da **no difference detected**.
   - Verificado en la base real, dentro de una transicion con `ROLLBACK` para no dejar datos: un solapamiento sigue rebotando por `exq_reserva_turno` (que ya usa `tstzrange`), una espera activa duplicada rebota por `unq_espera_clase_socio_activa`, los conteos quedan intactos y el instante se lee igual bajo una sesion en `America/Argentina/Buenos_Aires`.
   - El respaldo queda en `%TEMP%\opencode\prod-backup\prod-before-timestamptz.dump`, junto con `before.txt` y `after.txt` (los fingerprints de las 31 fechas). **Es local y temporal: no esta en el repo y hay que moverlo a un lugar seguro si se quiere conservar.**
2. **Al mergear la rama de Santino hay que correr `prisma migrate status` y `prisma migrate deploy`.** Los bloques 3 y 4 agregan migraciones y los nombres con timestamp no pueden pisarse. Si el merge introduce una migracion divergente, Prisma propondrá una espuria.
4. **El comparador sigue sin versionarse** (`backend/contrato/` esta en `.gitignore`). Mismo pendiente arrastrado desde M1.

---

## Unidad II — Alineación de M4 con la convención del contrato · Santino

### Semana 7 · SCRUM-11c — Canchas (Bloque 1) contra M1-M3: naming, rutas y excepciones

El Bloque 1 de M4 se había implementado antes de las auditorías de M1, M2 y M3, así que al traer esos cambios con el merge quedó con la convención anterior — y uno de los casos (`ProblemDetailsDto`) directamente dejó de compilar, porque ese archivo se renombró durante la auditoría de M1.

#### Actividades

1. **Import roto — `ProblemDetailsDto` → `Problem`**
   - `canchas.controller.ts` importaba `ProblemDetailsDto` desde `commons/swagger/problem-details.dto`, archivo que ya no existe (renombrado a `problem.dto.ts`/`Problem` en la auditoría de M1, SCRUM-11h). Bloqueaba la compilación.
   - [commit b8925e7](https://github.com/GonzaloVila/FitZone-Sports/commit/b8925e7)

2. **DTOs renombrados a la convención del contrato**
   - `CrearCanchaDto` → `CanchaIn`, `ModificarCanchaDto` → `CanchaPatch` (con `git mv`), `CanchaOutDto` → `CanchaOut`. Mismo criterio que M1/M2/M3: el nombre de la clase es el que sale en `components.schemas` del Swagger generado, y tiene que coincidir con el contrato.
   - [commit b8925e7](https://github.com/GonzaloVila/FitZone-Sports/commit/b8925e7)

3. **Rutas y parámetros a snake_case**
   - `:sedeId`/`:canchaId` → `:sede_id`/`:cancha_id` en rutas, `@Param` y `@ApiParam`. Las variables internas de TypeScript quedan en camelCase (no afecta el contrato, solo el código).
   - `@ApiParam({ type: Number })` → `type: 'integer'` en los dos parámetros de path y en `page`/`per_page` del query DTO.
   - [commit b8925e7](https://github.com/GonzaloVila/FitZone-Sports/commit/b8925e7)

4. **Excepciones de dominio migradas a `ProblemException`**
   - Los 3 `NotFoundException` de `CanchasService` (sede inexistente al crear, cancha inexistente en obtener/actualizar) pasan por `recursoNoEncontrado()`, igual que M1/M2/M3 (SCRUM-11d). Antes caían en el fail-safe de `resolveDetail()`; verificado que ya no generan `WARN` en el log.
   - [commit 7d1b360](https://github.com/GonzaloVila/FitZone-Sports/commit/7d1b360)

#### Verificación

- `npx tsc --noEmit` y `npm run build` en verde en las dos tandas.
- Runtime (puerto 3199): `GET /sedes/1/canchas` → 200; `GET /canchas/999999`, `PATCH /canchas/999999`, `POST /sedes/999999/canchas` → 404 `application/problem+json` con `title`, `detail` e `instance`, sin `WARN` del fail-safe.
- `/docs-json`: los 4 endpoints de canchas declaran `sede_id`/`cancha_id` como `integer`, sin parámetros fantasma del nombre viejo. Schemas generados: `Problem`, `CanchaIn`, `CanchaPatch`, `CanchaOut`.

#### Pendientes que siguen abiertos

1. **`CanchaOut` sin `type: 'integer'` en `id`, `sede_id`, `costo_por_hora`.** Mismo criterio que M1 (SCRUM-11e): se corrige módulo por módulo, no se adelantó acá.
2. **`GET /canchas/abc` responde 422, no 400.** Preexistente, mismo comportamiento que M2 (`GET /sedes/abc/aforo`) — no es un defecto introducido por esta alineación.

---

## Unidad II — Módulo 4: Canchas Deportivas · Bloque 3 · Santino

### Semana 7 · SCRUM-11c — Bloque 3: Reservas y disponibilidad (RF-10/RN-02/RN-03/RNF-03)

#### Actividades

1. **Crear y cancelar reservas — parte 1**
   - `ReservaRepository` con Prisma (`repositories/prisma/prisma-reserva.repository.ts`), DI por token string (`RESERVA_REPOSITORY`), resultado discriminado `ResultadoCrearReserva` — mismo criterio que `ResultadoCrearIngreso` de M2.
   - `ReservasCanchasService.crear()`, en orden: valida existencia de cancha (404) → `EN_MANTENIMIENTO` bloquea turnos nuevos (409, RF-12) → `fecha_hora_inicio < fecha_hora_fin` (422) → `MEMBERSHIP_VALIDATION_PORT.consultarVigencia()` con `@Optional()`, fail-open a precio de externo si el puerto no está (al revés que M2, que es fail-closed) → `PricingStrategyFactory.cotizar()` → `precio_aplicado` congelado al momento de la reserva → `crear()`, traduciendo `TURNO_OCUPADO` a 409.
   - **Verificado empíricamente el código de error de la constraint de exclusión**: Postgres tira la violación como `PrismaClientUnknownRequestError` con `.code` en `undefined` (a diferencia de `P2002`/`P2003`, que Prisma sí tipa), así que el `catch` matchea `error instanceof Prisma.PrismaClientUnknownRequestError && error.message.includes('exq_reserva_turno')`.
   - `cancelar()`: 404 si no existe, 409 si ya estaba `CANCELADA`, baja lógica si `CONFIRMADA` — el `WHERE estado <> 'CANCELADA'` de la constraint libera el horario sin limpieza adicional.
   - Validación de fecha más estricta que el resto del proyecto: `@IsISO8601({ strict: true })` + `@Matches` exigiendo offset de zona explícito. Sin esto, una fecha sin zona se interpreta según el huso del proceso (en Docker, UTC), desfasando 3 horas contra Argentina.
   - Smoke contra Supabase: reserva de socio con descuento (`precio_aplicado: 4250`), reserva en pico (`5100`), solapamiento parcial → 409, dos reservas simultáneas al mismo turno libre → una 201 y una 409 (confirma que la protección real vive en la base, no en el service), cancelación y re-reserva del mismo horario liberado, cancha en mantenimiento → 409, fechas invertidas → 422.
   - [commit 63eb2bd](https://github.com/GonzaloVila/FitZone-Sports/commit/63eb2bd)

2. **Listado de reservas y disponibilidad — parte 2**
   - `ReservaRepository.listar(filtros)`: lista blanca de filtros opcionales (`cancha_id`, `usuario_id`, `estado`, rango de fechas), paginado. El repositorio no decide ningún default — eso es regla de negocio.
   - `ReservasCanchasService.listar()`: sin `?estado=`, default `CONFIRMADA` — las canceladas no aparecen salvo que se pidan explícito (RF-12 conserva histórico, no visibilidad por defecto; al revés que el listado de canchas, que si no filtra muestra ambos estados). El filtro `fecha` se resuelve con `rangoDelDia()` (helper ya existente de M2) a un rango `[desde, hasta)`.
   - `DisponibilidadService.consultar()`: genera la grilla del día (constantes `GRILLA_HORA_INICIO/FIN/PASO_MINUTOS`, `08:00–22:00` cada 60 min — un supuesto del equipo, el contrato no fija rango ni paso, decisión 12 del plan). Si la cancha está `EN_MANTENIMIENTO`, devuelve todos los tramos `false` **sin consultar reservas** (RF-12 no necesita leer la tabla para saber que está todo bloqueado). Si no, cruza la grilla contra `listarOcupadasEnRango()`.
   - `consultarDisponibilidad` agregado a `canchas.controller.ts` (había quedado pendiente del Bloque 1, porque necesitaba leer reservas).
   - **Hallazgo en M2, no corregido acá**: `@IsISO8601({ strict: true })` detectó que `GET /ingresos?fecha=2027-02-30` en M2 no rechaza fechas inválidas — JavaScript las acomoda en silencio (2027-02-30 → 2 de marzo). M4 sí las rechaza (422). Queda como posible pendiente de M2, fuera del alcance de este bloque.
   - **Nota de diseño**: la grilla usa el offset fijo `-03:00` de `rangoDelDia()` (consistente con cómo M2 define "día de la sede"), no el nombre IANA `TIMEZONE_SEDE` que sí usa `peak-hour-pricing.ts` del Bloque 2. Hoy dan el mismo resultado porque Argentina no tiene horario de verano; quedan dos mecanismos distintos conviviendo en M4, por decisión consciente de priorizar consistencia con M2 sobre uniformidad interna.
   - Smoke: grilla vacía → todo `true`; una reserva ocupa solo su tramo (y los que cruza, si el turno es más largo que el paso); mantenimiento → todo `false`; aislamiento entre canchas y entre días verificado; filtro `fecha` confirmado contra el día de la sede, no el día UTC (reserva a las 23:00 local cae en el día correcto, no en el día siguiente por UTC).
   - [commit 47d90f9](https://github.com/GonzaloVila/FitZone-Sports/commit/47d90f9)

#### Pendientes que siguen abiertos

1. **`problem.filter.ts` con una rama muerta**: sigue mapeando `unq_reserva_turno`, índice que ya no existe (reemplazado por `exq_reserva_turno` en el Bloque 0). Es de `commons/`, no se tocó.
2. **`GET /ingresos?fecha=` de M2 no valida fechas inválidas** (ver hallazgo arriba) — posible pendiente para una futura pasada de M2.
3. Falta el Bloque 4 (QA, integración y cierre del módulo completo).

---

## Unidad II - Módulo 4: Canchas Deportivas — Bloque 3 — Integración en `main` (Gonzalo)

**Fecha:** 01/10/2026 — **Rama:** `main` — **Merge:** `9b68aa0`

### Integración del Bloque 3 de la rama `santino`

1. **Merge con conflictos resueltos a mano**
   - `git fetch origin --prune` movió `origin/santino` de `460f4a9` a `4063ff6` (7 objetos nuevos: 3 del Bloque 3 propiamente dichos — `63eb2bd`, `47d90f9`, `4063ff6` — más los 3 de alineación previa de M4 y el merge `8296ce9`).
   - El rango **no trae migraciones**: `Reserva.precio_aplicado`, `@@index([cancha_id, fecha_hora_inicio])` y `exq_reserva_turno` ya estaban en el modelo de `main`.
   - Referencia de seguridad creada antes de integrar: `backup/pre-m4-b3-20261001`.
   - `git merge --no-ff origin/santino` → 6 archivos en conflicto: `LOG.md`, `src/main.ts`, `canchas.controller.ts`, `dtos/cancha-in.dto.ts`, `dtos/cancha-patch.dto.ts`, `services/canchas.service.ts`.
   - [merge 9b68aa0](https://github.com/GonzaloVila/FitZone-Sports/commit/9b68aa0)

2. **Criterio de resolución**
   - `main.ts`: se conservan las auditorías previas (filtro global + `ValidationPipe` con `forbidNonWhitelisted`) y se suma `.addTag('reservas-canchas')`, que el contrato exige para que las 4 operaciones nuevas entren en el alcance del comparador.
   - DTOs de cancha: se conserva `minimum: 0` de `main` y se adoptan las `description`/`example` de la rama. El contrato manda sobre ambas ramas.
   - `CanchasService`: se conserva la validación de sede de `main` (no se puede crear una cancha en una sede inexistente) y se adopta `recursoNoEncontrado()` de la rama, que era la regresión que quedaba abierta del Bloque 1 (el `NotFoundException` caía en el fail-safe de `resolveDetail()` y logged `WARN`).

### Correcciones posteriores al merge

3. **Dos 409 distintos en `POST /reservas-canchas`**
   - La rama traía un único `conflictoDeDominio('Turno ocupado', ...)` para las dos causas de 409. Se separaron porque **no son la misma cosa**: `turno-ocupado` (RN-02) es concurrencia —otro usuario ganó el turno— y `cancha-en-mantenimiento` (RF-12) es una cancha inhabilitada, donde no hubo concurrencia y el `detail` del primero sería literalmente falso.
   - Los `type`/`title`/`detail` salen de una factory en `commons/filters/problem.exception.ts` (`turnoOcupado()`), no inline en el service, justamente para que la otra causa de 409 del mismo endpoint no acabe reusando ese texto.
   - [commit de corrección](https://github.com/GonzaloVila/FitZone-Sports/commit/9b68aa0)

4. **`cancelar()` repetida: 409 y no 404**
   - El contrato declaraba 404 para "reserva inexistente o ya cancelada". Se cambió a 409 con componente propio `ReservaYaCancelada`, porque la reserva **existe**: RF-12 conserva el histórico y `GET` sobre ella responde 200 con `estado: CANCELADA`. Lo que choca es la transición pedida contra el estado actual, el mismo hecho que M2 modela con `EgresoDuplicado`.
   - La carrera entre dos cancelaciones simultáneas ya estaba resuelta en el repositorio: el filtro por estado va en el `WHERE` del propio `UPDATE`, y un `P2025` se traduce al mismo 409.

5. **Rama muerta en `problem.filter.ts`**
   - El filtro seguía mapeando `unq_reserva_turno` dentro de la rama `P2002`. Ese índice **no existe**: lo sustituyó `exq_reserva_turno`, una constraint de `EXCLUSION` que Prisma no modela, así que su violación llega como `PrismaClientUnknownRequestError` y nunca por esa rama.
   - Se borró la rama muerta y se agregó la de `Unknown` para `exq_reserva_turno`, como red de contención: la regla sigue siendo que la traduzca `PrismaReservaRepository`, pero si alguna otra vía la deja pasar ahora es 409 en vez de 500.

### Contrato del vault

6. **Backup y cambios en `TFI FitZone - OpenAPI.yaml`**
   - Backup previo en `TFI/backups/TFI FitZone - OpenAPI.20261001-161430.yaml` (95.024 bytes).
   - `TurnoOcupado` → `ConflictoReservaCancha`: **OpenAPI admite un solo 409 por operación** y esta declara las dos causas de 409, así que van en una respuesta con dos `examples` (`turno-ocupado` y `cancha-en-mantenimiento`) que distinguen por `type`.
   - Nuevo `ReservaYaCancelada`, referenciado por `POST /reservas-canchas/{id}/cancelaciones`, que pasa a declarar 409. La `description` de esa operación también se corrigió: decía "una reserva inexistente o ya cancelada responde 404".
   - `GET /canchas/{cancha_id}/disponibilidad`: se agregaron los `$ref` de `Page` y `PerPage`, que faltaban. Su propia `description` ya decía "Solo admite `?fecha=` y paginación" — la lista blanca y la prosa no coincidían.
   - Verificado: el YAML parsea, 75 `$ref` totales, 0 rotos, y `TurnoOcupado` ya no queda referenciado por nadie.

### Desalineaciones que había y cómo se resolvieron

7. **Comparador de contrato: de 10 diferencias a 0**

   | Diferencia | Decisión |
   |---|---|
   | `esquema-falta:EstadoReserva` | Permitida: enum con nombre en el contrato, inline en el código. Mismo caso que `Rol`, `Plan`, `EstadoReservaClase`. |
   | `ReservaCanchaIn` exige `usuario_id`, el contrato lo deja opcional | Permitida con fecha de vencimiento: el contrato dice "Si se omite, se toma del token en la Unidad III" y **todavía no hay token** (decisión 13 del plan M4). Se borra cuando exista. |
   | `?estado=` con `default: CONFIRMADA` en el código | **Corregido en el código.** El default es regla de negocio y vive en el service; el contrato declara el filtro como `$ref: EstadoReserva` sin default. Mismo criterio que `ListarReservasClaseQueryDto`. |
   | `summary` distinto en 3 operaciones | **Corregido en el código** para que coincida con el contrato. |
   | `422` faltante en la cancelación | **Corregido en el código.** |
   | `page`/`per_page` de más en disponibilidad | **Corregido en el contrato** (ver punto 6). |

8. **`test/m4.e2e-spec.ts`: 18 casos nuevos**
   - Lo que se protege sobre todo son los dos 409 de la creación y el 409 de la cancelación repetida, porque comparten código y no pueden devolver el mismo `type`.
   - Hay un caso que **solo puede pasar si la constraint existe en la BD**: un turno 12:30-13:30 contra uno 12:00-13:00. El `unique` parcial `(cancha_id, fecha_hora_inicio)` lo dejaría pasar; `exq_reserva_turno` no. Un `if` en el service también lo dejaría pasar.
   - También se cubren: descuento de socio vigente (4250), socio vencido cobro como externo (5000), turno encadenado (13:00 sobre un 12:00-13:00 sí entra), horario liberado al cancelar, mantenimiento que devuelve la grilla entera en `false` **sin borrar** la reserva previa, y los filtros de listado.

### Verificación

- `npx tsc --noEmit`, `npm run build` y `npx prisma validate`: en verde.
- `npm run test:unit`: 10/10.
- `npm run test:e2e`: 79/79 (61 previos + 18 nuevos de M4).
- Comparador de contrato: **0 diferencias** contra el YAML del vault.
- Runtime real (`/docs-json`): 4 operaciones de `reservas-canchas` más `consultarDisponibilidad` publicadas con sus respuestas.

### Pendientes que siguen abiertos

1. **`GET /ingresos?fecha=` de M2 no valida fechas inválidas** — sigue sin tocarse. Es deuda de M2, ajena a este bloque.
2. **Deuda de M3, registrada y no tocada**: `POST /reservas-clases/{id}/cancelaciones` y `DELETE /esperas-clases/{id}` responden **204 silencioso** al repetir una cancelación, mientras el contrato declara 404. Se decide junto con M3, no desde M4.
3. **Bloque 4**: QA, integración y cierre del módulo. Sin arrancar.


---

## Unidad II - Módulo 1: Usuarios, Socios y Membresías — Invariante de membresía obligatoria (Gonzalo Vila)

**Fecha:** 01/10/2026 — **Rama:** `invariante-membresia-obligatoria` — **Commit:** [`eefefc6`](https://github.com/GonzaloVila/FitZone-Sports/commit/eefefc6) — **Estado:** en la rama, sin mergear a `main`

### El problema

1. **El alta era en dos pasos y la invariante era una convención, no una regla.**
   - `POST /socios` aceptaba `plan` como opcional y, si no venía, creaba el `Socio` **sin** fila de `Membresia`: el `crear()` del repositorio envolvía la creación de la membresía en un `if (socio.plan)`.
   - Es decir, *el socio sin membresía era un estado alcanzable por la API*. Cumplir la regla que el dominio decía cumplir dependía de que el cliente supiera que después tenía que llamar a `POST /socios/{socio_id}/membresias`.
   - Nada impedía el estado: la relación de Prisma es opcional, la columna no es `NOT NULL`, y ningún filtro lo rechazaba.
   - [commit `eefefc6`](https://github.com/GonzaloVila/FitZone-Sports/commit/eefefc6)

2. **La decisión: el plan es obligatorio y la fila se crea siempre.**
   - `SocioIn.plan` pasa a requerido y `PrismaSocioRepository.crear` escribe `Socio` y `Membresia` en la misma `$transaction` y **sin rama**: no queda camino por el que la membresía no se cree.
   - `calcularVigencia()` se sigue invocando sin segundo argumento, así que la vigencia se calcula en el dominio exactamente igual que antes.

### Qué se eliminó

3. **`POST /socios/{socio_id}/membresias` completo.**
   - Se va el `@Post()` del controller, el `crear()` del service, el `crear()` de `MembresiaRepository` y su implementación en `PrismaMembresiaRepository`.
   - Se va `MembresiaIn`, que solo existía para ser el body de ese endpoint.
   - Se va `MembresiaNueva`, que solo existía como parámetro de ese `crear()`.
   - **El 409 de "membresía existente" desaparece con el endpoint.** Los dos 409 que quedan en M1 son el de unicidad y el de "el usuario ya es socio".

### Consecuencias aceptadas

4. **`fecha_inicio` pierde su única vía de escritura.**
   - `MembresiaIn.fecha_inicio` era el único lugar por el que un cliente podía fijar el inicio de una membresía. Sin endpoint de alta, toda membresía **arranca hoy**.
   - Se acepta: el caso de uso no pide retroactividad, y la renovación no crea filas nuevas — sigue actualizando `fecha_fin` sobre la misma fila 1:1.
   - Lo que **no** se pierde es la lectura: `MembresiaOut.fecha_inicio` sigue expuesto, y M5 renueva sobre la fila existente.

5. **La relación de Prisma sigue siendo opcional. A propósito.**
   - La garantía es de aplicación y ya no existe más de un camino de escritura por el que esquivarla, que era el problema real.
   - Volverla `NOT NULL` exigiría una migración sobre la base compartida **sin cerrar ningún hueco que quede abierto**: nadie escribe un `Socio` sin pasar por `PrismaSocioRepository.crear`.
   - Lo que sí se documenta es el costo: una escritura que esquive el repositorio (un `prisma.membresia.create` suelto, un script) no la frena la base. La invariante vive en la aplicación.

6. **El 404 de "el socio no posee una membresía activa" queda como defensivo.**
   - Sigue en `obtenerPorSocioId()` y `modificar()` con su mensaje propio, porque un `buscarPorSocioId` que devuelva `null` sigue siendo un resultado posible del tipo. Ya no es alcanzable por la API.

### Cambios menores que salieron de esto

7. **`PlanMembresia` se mudó de `socio.entity.ts` a `membresia.entity.ts`.**
   - Estaba declarado en `socio.entity.ts` solo porque `SocioNuevo` lo tenía opcional. Con el plan obligatorio, que un recurso declare un tipo que no posee es ruido: `Membresia` ya tenía `plan: PlanMembresia` y lo importaba de vuelta.
   - Ahora `membresia.entity.ts` declara `PlanMembresia` y `EstadoMembresia` juntos, y `socio.entity.ts` lo importa. Se invierte la dependencia: `membresia.entity.ts` ya no importa nada de `socio.entity.ts`.

### Contrato del vault

8. **Backup y cambios en `TFI FitZone - OpenAPI.yaml`**
   - El estado previo a este cambio es recuperable del backup `TFI/backups/TFI FitZone - OpenAPI.20261001-161430.yaml` (95.024 bytes, **47 operaciones**, con `crearMembresia` y `SocioIn.required: [usuario_id, sede_origen_id]`). Ese backup era el estado anterior y quedó como referencia.
   - Backup del estado nuevo: `TFI/backups/TFI FitZone - OpenAPI.20261001-174657.yaml` (95.360 bytes).
   - **47 → 46 operaciones**: se elimina `crearMembresia`. Es la única operación que se va; no se agregó ninguna.
   - `SocioIn.required` pasa a `[usuario_id, sede_origen_id, plan]`, y la `description` de `plan` pasó de "Si se indica, se crea la membresía inicial con este plan en la misma transacción" a la redacción de la obligatoriedad.
   - Las `description` de los 404 de `GET` y `PATCH /socios/{socio_id}/membresias` pasaron de "Socio o membresía inexistente" a "Socio inexistente", porque el segundo caso ya no puede darse por API.
   - Verificado: el YAML parsea y no quedan `$ref` colgantes.

### Tests

9. **`test/m1.e2e-spec.ts`: 9 casos, y `test/errores-dominio.e2e-spec.ts`: 8.**
   - Se eliminan los **3 casos** del endpoint borrado y el caso que dependía de poder crear un socio sin membresía.
   - Entra un caso de **plan ausente → 422** que además comprueba que el reintento *con* plan falla por socio duplicado y no por otra causa: si el 422 no fuera del `ValidationPipe`, el segundo intento devolvería 201.
   - El caso de filtros `?estado_membresia=&plan=` se reescribió con **dos planes en vez de uno**, porque el anterior usaba justamente al socio sin membresía para obtener un conjunto distinto. Ahora los dos filtros se distinguen por el plan y el caso no depende de un estado imposible.

### Verificación

- `npm run build`: limpio.
- `npm run test:unit`: **10/10**.
- `npm run test:e2e`: **77/77**.
- Comparador de contrato: **28/28**, **0 diferencias**, 46 operaciones (5 fuera de alcance: los módulos M5 y lo que aún no está implementado).
- Runtime real (`/docs-json`): el backend publica 41 operaciones y `socios`/`membresias` ya no expone ningún `POST` de membresías.

### Estado de `main` y por qué este trabajo no esperó al Bloque 4 de M4

10. **`main` local estaba 20 commits adelante de `origin/main` y se publicó.**
    - El merge de M4 `9b68aa0` y su corrección `325f386` estaban **integrados solo en el `main` local**: `origin/main` seguía en `3ff0a2a` (cierre de M3). Por eso `origin/main..origin/santino` seguía devolviendo los 10 commits de M4 aunque el LOG ya los daba por integrados.
    - `git push origin main` los publica. Es **fast-forward** (`3ff0a2a` es ancestro directo), sin force ni reescritura: 20 commits, 18 de trabajo y 2 merges.
    - Efecto: `origin/santino` queda con **0 commits pendientes**. Santino tiene que actualizar antes de arrancar el **Bloque 4**, que sigue sin empezar.
    - También quedan ciertas las dos entradas del LOG y el plan de M4 que ya afirmaban que M4 estaba integrado: antes era cierto solo en local, ahora lo es en el remoto.
    - Este trabajo **no** se bloqueó por el Bloque 4 de M4: se verificó que `origin/santino` no toca ninguno de los 15 archivos modificados acá, así que el único archivo en común entre ambos trabajos es `LOG.md`.

### Pendientes que siguen abiertos

1. **El contrato no está en Git.** `backend/contrato/contrato.spec.ts` lo lee de `FITZONE_CONTRACT_PATH`, que sale de `backend/.env.test` y está gitignored a propósito. **La versión de 46 operaciones solo existe en el YAML del vault**: cualquiera que corra el comparador contra una copia de 47 va a ver 1 diferencia en `SocioIn.required` y una operación de más. Hay que sincronizar el archivo con el equipo antes de que alguien lo ejecute.
2. **`Bloque 4` de M4**: QA, integración y cierre del módulo. Sin arrancar, y ahora sobre una `main` que incluye este cambio.
3. **La invariante es de aplicación, no de base de datos.** Si algún día se escribe un `Socio` por fuera de `PrismaSocioRepository.crear`, nada lo va a frenar.
4. **QR y TOTP** siguen diferidos, sin arrancar.

---

## Unidad II - Migración de M1-M5 a arquitectura en capas – Exequiel Ansaldi (P2 - Backend Developer)

**Fecha:** 01/10/2026 – **Rama:** `capas-en-todo-el-backend` – **Base:** `main` (`325f386`) + la invariante de membresía (`eefefc6`, que tiene su propio PR) – **Estado:** **mergeada en `main`** el 02/10/2026, en fast-forward. Ver la entrada del 02/10 que cierra la rama.

### El problema

1. **Convivían dos arquitecturas.** M1-M4 ya estaban en capas, pero con la forma hexagonal puesta en el medio: cada repositorio era una interfaz `XRepository` más una implementación `PrismaXRepository` en `repositories/prisma/`, resuelta por un `InjectionToken` de string, y M1/M2 eran `@Global()`. M5 era hexagonal entero (`domain/ports/in|out`, `application/use-cases`, `infrastructure/adapters/out`) y su única puerta de entrada era `commons/mediador/`.

2. **La indirección no pagaba nada.** Cada interfaz de repositorio tenía una sola implementación, el token se resolvía por constructor y nadie iba a registrar un doble para testear: el puerto se pagaba con más archivos y más DI, no con testeabilidad.

3. **Lo que sí pagaba, y para mal, eran los puertos opcionales.** Tres dependencias se inyectaban con `@Optional()` y cada una tenía un bypass silencioso detrás:

   | Puerto | Módulos que lo usaban | Qué pasaba si no estaba |
   |---|---|---|
   | `MEMBERSHIP_VALIDATION_PORT` | M3 (reservas y esperas de clase), M4 (reservas de cancha) | **Fail-open**: no se consultaba la vigencia y el socio con cuota vencida pasaba a la cola o pagaba precio de externo |
   | `CONSULTA_SOCIO_PORT` | M3 (`EmailCupoLiberadoObserver`) | El aviso de cupo liberado se perdía sin dejar rastro |
   | `SEDE_VALIDATION_PORT` | M2 (creación de clase), M4 (creación de cancha) | Fail-closed: la validación se hacía siempre |

   El único que fallaba en silencio era el dangerous: la regla RN-03 se podía saltar sin que nadie lo notara.

4. **M5 nunca llegó a implementarse, y el Mediador lo hacía explícito.** El puerto `PROCESAR_PAGO_PORT` no lo registraba ningún provider, así que `MediadorService.solicitarCobro()` solo podía rechazar con "M5 (Pagos) aun no registra ProcesarPagoPort".

### La decisión

5. **Los cinco módulos en capas, sin puertos.** Criterio, para que no sea una preferencia de estilo:
   - El repositorio es una clase concreta con `PrismaService` inyectado. Si algún día aparece una segunda implementación, se extrae la interfaz en ese momento; extraerla antes es coste pagado a cambio de nada.
   - La dependencia entre módulos es explícita en el `imports`, y por eso `M1` y `M2` dejaron de ser `@Global()`: es preferible que el `imports` diga la verdad a que el grafo se esconda.
   - **Strategy y Observer no son puertos y se quedan**: `PricingStrategyFactory` con sus tres estrategias y la cadena `CupoLiberadoSubject` siguen exactamente como estaban.

6. **M5 quedó solo como andamiaje: `entities/` y `pagos.module.ts`, sin controllers ni providers, y sin registrar en `AppModule`.** No es una decisión por comfortable: el comparador de contrato calcula el alcance por **rutas realmente publicadas**, no por tags, así que las cinco operaciones de M5 (`GET /pagos`, `POST /pagos`, `GET /pagos/{pago_id}`, `GET /pagos/{pago_id}/comprobante` y `POST /pagos/{pago_id}/anulaciones`) quedan fuera de alcance y dan 0 diferencias. Escribir un controller a medias publicaría rutas que el contrato no describe igual.

### Trabajo por módulo

| Commit | Módulo | Qué hizo |
|---|---|---|
| [`026c0bb`](https://github.com/GonzaloVila/FitZone-Sports/commit/026c0bb) | M1 | Repositorios aplanados a clases concretas; las consultas de vigencia pasaron a `MembresiasService` y `obtenerEmail()` a `SociosService`; se fueron `MEMBERSHIP_VALIDATION_PORT` y `CONSULTA_SOCIO_PORT` con sus adapters |
| [`cc87947`](https://github.com/GonzaloVila/FitZone-Sports/commit/cc87947) | M2 | `IngresoRepository` y `SedeRepository` concretos; `SEDE_VALIDATION_PORT` virou `SedesService.existe()` |
| [`29dab5c`](https://github.com/GonzaloVila/FitZone-Sports/commit/29dab5c) | M3 | Repositorio de clase, espera y reserva aplanados; filtros y resultados discriminados reubicados junto a la implementación; `ClasesModule` dejó de exportar repositorios |
| [`7104351`](https://github.com/GonzaloVila/FitZone-Sports/commit/7104351) | M4 | `CanchaRepository` y `ReservaRepository` concretos; `PricingStrategy` pasó a `pricing-strategy.ts` y se borró el token muerto `PRICING_STRATEGY` |
| [`d8f5165`](https://github.com/GonzaloVila/FitZone-Sports/commit/d8f5165) | M5 + commons | Andamiaje hexagonal de M5 eliminado y `commons/mediador/` borrado por completo |
| [`d944582`](https://github.com/GonzaloVila/FitZone-Sports/commit/d944582) | M5 | Carpetas de capas versionables + la frontera interna de pagos, y corrección de la dirección del grafo en los comentarios |

7. **Los resultados discriminados y los filtros se movieron junto a su implementación.** `ResultadoCrearEspera`, `ResultadoConfirmarEspera`, `MotivoFalloReserva` y compañía vivían en archivos `*.ts` separados al lado de la interfaz que los tenía; ahora están en el mismo archivo que el repositorio que los produce, porque un tipo sin su productor es un tipo que nadie encuentra.

### El Mediador

8. **`commons/mediador/` desaparece entero**: `MediadorService`, `PROCESAR_PAGO_PORT` y `procesar-pago.port.ts`. El grafo queda `M2 → M1`, `M3 → M1, M2`, `M4 → M1, M2`, y M5 sin imports porque todavía no hay casos de uso. Cuando existan, la dependencia va de **M1/M4 hacia `PagosModule`**, que es justo lo que el Mediador evitaba a cambio de perder la visibilidad: con capas esa dependencia se lee en el `imports` del módulo.

9. **`SolicitudCobro` y `ComprobanteDto` pasaron al dominio de M5** (`entities/solicitud-cobro.entity.ts`), que es donde habían quedado al borrarse el puerto. Reaprovechan `ConceptoPago` y `EstadoPago` en lugar de volver a declarar los mismos cuatro valores con otro nombre: la diferencia real entre la `SolicitudCobro` interna y el `PagoIn` del contrato es el **monto**, que el DTO HTTP no lleva porque lo computa la regla de negocio y la solicitud interna ya lo trae resuelto desde el módulo que origina el cobro.

10. **`CommonsModule` quedó vacío pero se conserva.** Era el módulo que existía solo para exportar el Mediador; se deja como el lugar natural para lo transversal que sí va a aparecer (el guard por rol de la Unidad III, hoy `guards/` es un placeholder con un `.gitkeep`).

### Lo que cambió de verdad

11. **Tres dependencias opcionales pasaron a obligatorias.** No es reubicación: es un cambio de comportamiento, y en dos casos del bueno.

   | Antes | Ahora | Efecto si M1 no está disponible |
   |---|---|---|
   | `MEMBERSHIP_VALIDATION_PORT` con `@Optional()` | `MembresiasService` obligatorio | La app **no levanta** en vez de cobrar precio de externo |
   | `CONSULTA_SOCIO_PORT` con `@Optional()` | `SociosService.obtenerEmail()` | El observer **lanza** en vez de perder el aviso |
   | `SEDE_VALIDATION_PORT` | `SedesService.existe()` | Igual que antes (ya era fail-closed), sin token de por medio |

   El criterio es que una dependencia que se puede faltar es una dependencia que puede faltar **en silencio**, y el silencio en una regla de negocio es un bug esperando.

12. **Un bug que solo se manifestó al quitar los tokens.** Durante la migración, algunos repositorios quedaron con `import type { ClaseRepository }`. Nest lee la metadata de tipos del constructor para resolver dependencias, y con `import type` la clase vale `Object` a esa altura: el arranque falla con `Nest can't resolve dependencies of the service (?)`. Con los puertos esto no se veía nunca, porque el token era explícito y no dependía de la clase importada. Los tipos de dominio (`entities`, filtros, `OpcionesPaginacion`, `PricingContext`) sí pueden ser `import type`: no se inyectan, solo se usan como tipos.

### Verificación

- `npx tsc --noEmit` y `npm run build`: en verde.
- `npm run test:unit`: **20/20** en 3 archivos. Los 10 nuevos son de `membresias.service.spec.ts` y cubren RN-03: sin `MembresiasService` la app no arranca, y la vigencia se decide en el dominio.
- `npm run test:e2e`: **77/77** en 6 archivos, sin tocar un solo caso.
- Comparador de contrato: **3/3**, **41 operaciones a comparar y 34 schemas**, 5 operaciones (todas de M5) fuera de alcance, **0 diferencias por módulo**.
- `git grep` sobre `src/`: **cero** ocurrencias de `InjectionToken`, cero de puertos como tipo de inyección, cero de `MediadorService` y cero de carpetas `ports/`, `adapters/` o `use-cases/`. Lo que queda son comentarios que explican qué había antes y por qué la dependencia ahora es obligatoria, que es la parte que un lector futuro necesita, y un `@Global()` legítimo: el de `DatabaseModule`, que comparte el `PrismaService` con todos los módulos.

### Pendientes que siguen abiertos

1. **M5 no tiene comportamiento.** Faltan `PagosService`, `PagoRepository`, `PasarelaPagoService`, `ComprobantesService` (RF-14) y los cinco endpoints. El andamiaje está, el grafo todavía no.
2. **La documentación del vault sigue describiendo la arquitectura hexagonal.** El ADR-01 del Mediador, el plan de trabajo de M5, los diagramas C4, `TFI FitZone - Unidad II - Backend.md` y el checklist del TFI quedaron desalineados con el código. Hay que reescribirlos con el grafo real y con M5 explícitamente pendiente.
3. **El contrato sigue fuera del repo** (`backend/contrato/` está gitignored). Mismo pendiente arrastrado desde M1, sin cambios.
4. **La rama incluye la invariante de membresía** (`eefefc6`), que va en su propio PR. Al integrar hay que decidir el orden: los dos trabajos solo se tocan en `LOG.md`, así que el conflicto, si aparece, es de bitácora.
5. **Autenticación y roles** siguen diferidos. `commons/guards/` es un placeholder y el plan los necesita antes de que `usuario_id` deje de ser el único control de pertenencia.

---

## Unidad II - Módulo 4: Canchas Deportivas — Bloque 4 (QA, integración y cierre) — Gonzalo

**Fecha:** 02/10/2026 — **Rama:** `capas-en-todo-el-backend` — **Commits:** `54baddb` (M4), `2934da1` (M1)

### El bloque 4 no tenía nada que codear, tenía algo que medir

Revisando el §7.1 del plan contra el estado real, casi todo lo que el bloque pedía ya estaba cubierto: `tsc` y `build` en verde, el comparador de contrato en 0 diferencias, y los 18 casos de `m4.e2e-spec.ts` cubriendo uno a uno el smoke que el plan describe. Pero el smoke era de reservas y disponibilidad. Al medir la cobertura real de los endpoints por HTTP:

| Endpoint | Llamadas en toda la suite e2e |
|---|---|
| `GET /sedes/{sede_id}/canchas` (`listarCanchas`) | **0** |
| `POST /sedes/{sede_id}/canchas` (`crearCancha`) | **0** |
| `GET /canchas/{cancha_id}` (`obtenerCancha`) | **0** |
| `PATCH /canchas/{cancha_id}` (`modificarCancha`) | 1, de paso al probar el mantenimiento |

Tres de los ocho endpoints de M4 no se ejercitaban nunca, y el cuarto solo de rebote. RF-09 entero estaba sin probar: el alta y el tarifado se creaban por Prisma en el `beforeAll`, así que el camino HTTP completo —el `Location`, el default `OPERATIVA`, el 404 de sede inexistente, el 422 de DTO, la paginación, los filtros— no lo cubría nadie. La suite de M4 pasa de 18 a **36 casos**.

### Dos defectos que aparecieron al ejercitar

1. **El listado devolvía 422 sin declararlo, y la causa era una omisión del contrato, no una decisión.** El comentario en `canchas.controller.ts` decía *"Sin 422: el contrato declara solo 200 y 404. El plan lo pedía y el contrato manda sobre el plan"* — un razonamiento circular que tomó un descuido por autoridad. Comparando los cuatro listados paginados de la API contra el YAML: `GET /sedes` → 200 + 422, `GET /ingresos` → 200 + 422, `GET /reservas-canchas` → 200 + 422, `GET /sedes/{sede_id}/canchas` → 200 + 404. El único sin 422 era justamente este, y los tres hermanos ya tenían su `@ApiUnprocessableEntityResponse` con PROBLEM_JSON. La `ValidationPipe` global valida los query params con el mismo rigor que los bodies (`@IsIn`, `@Min(1)`, `@Max(100)`, más `forbidNonWhitelisted`), así que `?estado=INVALIDA`, `?page=0`, `?per_page=101` y cualquier parámetro desconocido dan 422. Se agregó `"422": $ref ValidationError` a la operación en `TFI FitZone - OpenAPI.yaml` (snapshot en `backups/TFI FitZone - OpenAPI.20261002-022308.yaml`) y el decorator en el controller. **El comparador exige los dos lados**: `compararRespuestas` compara el conjunto de códigos ordenado en ambos sentidos, así que tocar solo el YAML o solo el controller lo rompe. Quedó en 0 diferencias sin necesidad de una entrada nueva en `PERMITIDAS`.

2. **`PATCH /canchas/{cancha_id}` con body `{}` respondía 200 sin cambiar nada.** Los dos campos del `CanchaPatch` son opcionales, así que `{}` pasaba la validación y `CanchaRepository.actualizar` armaba el `data` con spreads condicionales hasta llegar a un `data: {}`. La primera hipótesis fue que eso explotaba como `PrismaClientValidationError` y se escapaba sin traducir del `catch`, o sea un 500; **al medirlo no era cierto**. Prisma 6.19.3 trata un `update` sin campos como un *no-op*: devuelve la fila sin error, con lo que la respuesta era un 200 que decía "actualizado" sin haberse actualizado nada. El defecto real es el dishonesty del código de estado, no una excepción. `CanchasService.actualizar` corta ahora antes con un 422 si no llega ningún campo, y el test verifica que la fila tampoco se tocó.

   La misma comprobación se hizo sobre los tres PATCH de M1 (`/usuarios/{id}`, `/socios/{socio_id}` y `/socios/{socio_id}/membresias`) y confirmó los tres 200 silenciosos, así que se les aplicó la misma guarda: los seis PATCH de la API se comportan igual ante `{}`. Los tests se escribieron primero y fallaron con `expected 422 "Unprocessable Entity", got 200 "OK"`, que es la evidencia de que el comportamiento viejo era el no-op y no una excepción. El contrato ya declaraba 422 en las cuatro operaciones, así que no hizo falta tocar el YAML.

   Se descartó `@IsNotEmptyObject()` como solución: exporta un `PropertyDecorator` de 2 argumentos y no compila aplicado sobre la clase (`TS1238`, *"Unable to resolve signature of class decorator"*). La guarda quedó en el service, que es donde ya viven los otros 422 de dominio del módulo (el de `rango-horario-invalido` de `ReservasCanchasService`).

### Dos casos que atan RF-09 con el resto del módulo

No se agregaron solo como cobertura de canchas, sino porque son los únicos que demuestran que el endpoint está bien conectado al resto:

- Una cancha creada por `POST /sedes/{id}/canchas` **ya está reservable al instante** (RNF-04), sin esperar nada.
- Un `PATCH` a `EN_MANTENIMIENTO` hace que la reserva siguiente falle con **409 `cancha-en-mantenimiento`**, y no con `turno-ocupado`. El `detail` se verifica para que no contenga el texto del otro 409, que sería falso: en mantenimiento no hubo concurrencia.

El 409 de mantenimiento ya estaba cubierto, pero metiendo la cancha en mantenimiento por Prisma; se llega ahora por el endpoint, que es justamente lo que conecta RF-09 con RF-12.

### Corrección de documentación

En el plan de M4 (`TFI FitZone - Plan de Trabajo M4.md`):

- **La paginación no se llama `perPage` de punta a punta**, como decía la sección 4.2. El contrato define un parámetro compartido `PerPage` con `name: per_page` en `components/parameters`, referenciado por los 13 listados de la API, y `Page` con `name: page`. En el cable y en el `ListarCanchasQueryDto` es `per_page`; recién en la frontera controller → service pasa a `perPage`. El código estaba bien; el texto del plan era el que mentía. Corregido en las dos menciones.
- La sección 1.1 ya no dice que el listado no declara 422, y el §7.1 refleja el cierre con los números reales en vez de los copiados del plan (que seguían diciendo 79/79 e unitarios 10/10, valores que no habían cambiado desde el bloque 3).
- Se agregó una nota de corrección del 02/10 junto a la del 01/10, con el snapshot del contrato.

### Verificación

- `npx tsc --noEmit` y `npm run build` (`nest build`): en verde.
- `npm run test:unit`: **20/20** en 3 archivos.
- `npm run test:e2e`: **98/98** en 6 archivos (77 previos + 18 nuevos de M4 + 3 nuevos de M1).
- Comparador de contrato contra el YAML del vault con el server arriba y `/docs-json` respondiendo 200: **3/3**. El documento tiene 46 operaciones y 38 schemas; se comparan **41 operaciones** (5 de M5 fuera de alcance), **0 diferencias** y las mismas 11 desviaciones de siempre en `PERMITIDAS`. Sin entradas nuevas.
- El server que se levantó para el comparador se bajó al terminar (PID 17984).

## 2026-10-02 — El contrato canónico entra al repo

**Rama:** `capas-en-todo-el-backend` — **Commit:** `5091bb9`

### El problema era más grande que el YAML

El pendiente era "el contrato está fuera del repo". Al buscarlo resultó que **`backend/contrato/` entero estaba en `.gitignore`**, con el comentario *"Comparador de contrato (herramienta local, nunca versionada)"*. O sea que tampoco estaban versionados:

- `comparar.ts` con las 11 entradas de `PERMITIDAS`, que son el registro de todas las desviaciones que se aceptaron a propósito.
- `comparar.spec.ts` y `resolver.spec.ts`, que son unitarios reales y que además **no corrían nunca** con `npm run test:unit`, porque esa config incluye solo `src/**`.

Un puente que nadie ve revisar es un puente que nadie revisa. La regla que decide qué diferencias son bugs y cuáles son aceptadas estaba fuera de Git, y nadie la podía auditar en un PR.

### El sentido ahora es uno solo

```
backend/contrato/openapi.yaml   ← canónico. Se edita acá, viaja en el PR.
        │ npm run contrato:exportar
        ↓
TFI FitZone - OpenAPI.yaml (vault)   ← entregable, generado
```

El riesgo residual es el contrario del que había: ya no puede desincronizarse en silencio, pero se puede **entregar un vault viejo** si uno edita el repo y se le pasa exportar. Para cerrarlo:

- `exportar.ts` copia repo → vault y anota el SHA en `vault-exportado.json`.
- `contrato:verificar` distingue cuatro estados, no dos: vault distinto del canónico; coincidencia **sin** línea base registrada; manifiesto con otro SHA, que significa que alguien editó el entregable en vez del repo; y el ok.
- `canonico.spec.ts` corre **sin servidor** y valida que el YAML sea un OpenAPI parseable, que los cuatro PATCH declaren 422, y que el vault no haya quedado viejo.

### El spec que necesita el server quedó aparte

`contrato.spec.ts` pasó a ser `contrato.diff.spec.ts`, con su propio proyecto de vitest (`npm run test:contrato:diff`). Antes estaba en el proyecto general, así que `npm run test:contrato` solo podía dar verde si alguien se acordaba de levantar el backend — y entonces el comando no cumplía su función. Ahora `npm run test:contrato` es 29/29 sin levantar nada, y el diff es un paso aparte y explícito.

### Dos cosas que aparecieron de paso

- **`js-yaml` se usaba sin estar declarado.** El comparador lo importaba desde siempre y funcionaba solo porque `@nestjs/swagger` lo trae de forma transitiva; un bump de esa dependencia lo rompía sin avisar. Ahora es `devDependency` declarada.
- **`FITZONE_CONTRACT_PATH` estaba en `.env.test` apuntando al vault**, y eso **anulaba** el default de la copia del repo. Mientras estuviera ahí, el comparador seguía leyendo el vault y el canónico seguía siendo una segunda fuente de verdad. Se sacó de `.env.test`; la variable sigue funcionando como override.

### Verificación

- `npx tsc --noEmit` y `npm run build`: en verde.
- `npm run test:unit`: **20/20** en 3 archivos.
- `npm run test:e2e`: **98/98** en 6 archivos.
- `npm run test:contrato` (sin server): **29/29** en 3 archivos.
- `npm run test:contrato:diff` (con server): **3/3**, 41 operaciones y 34 schemas comparadas, **0 diferencias**.
- `npm run contrato:verificar`: exit 0, vault y canónico con el mismo SHA.
- Server bajado al terminar (PID 10636).

### Pendientes que siguen abiertos

1. **M5 no tiene comportamiento.** Sin cambios respecto de la entrada anterior.
2. **El contrato ahora es canónico dentro del repo** (`backend/contrato/openapi.yaml`), y el YAML del vault se genera desde ahí con `npm run contrato:exportar`. Esta deuda queda cerrada: el diff del contrato viaja en el PR, las 11 entradas de `PERMITIDAS` y la lógica del comparador están versionadas, y `canonico.spec.ts` falla sin server si el vault quedó viejo. El riesgo residual es el otro: que uno edite el repo y se le pase exportar. Para eso está `contrato:verificar` y el manifiesto con el SHA del último export.
3. **El plan de M4 ya no describe la arquitectura vieja.** Reescrito §3.1, §4.1 y §4.2 contra el árbol real, y corregidas además las referencias sueltas que quedaban en §2, §3.3, §5, §6 y §8: se eliminaron `SEDE_VALIDATION_PORT`, `MEMBERSHIP_VALIDATION_PORT`, `CANCHA_REPOSITORY`, `RESERVA_REPOSITORY`, `PRICING_STRATEGY`, `pricing-strategy.port.ts` y los adaptadores `prisma-cancha` / `prisma-reserva`. Ahora el plan dice lo mismo que el código: repositorios como clases concretas `@Injectable()` (Data Mapper sin carpeta `prisma/`), `pricing/` como dominio puro sin token ni provider, y sede y vigencia resueltas llamando al servicio público del módulo vecino (`SedesService`, `MembresiasService`) con el módulo en `imports`. Las decisiones corregidas quedaron anotadas como tales en vez de borradas, para que se vea que hubo una decisión y cambió.
4. ~~Los planes de M1, M2 y M3 tienen el mismo problema~~ — **cerrado el 02/10**, ver la entrada siguiente. Ya no quedan menciones activas de la arquitectura vieja en ninguno de los cuatro planes.
5. **`PICO_RECARGO_PCT = 20`** sigue pendiente de confirmación con la cátedra. Vive aislado en `pricing-constants.ts` con el comentario que lo declara, así que cambiarlo es una línea.
6. **No se valida el turno contra el horario de la sede** porque ese dato no existe en el modelo. Deuda asumida a propósito (decisión 11 del plan M4).
7. **`ReservaCanchaIn.usuario_id` es obligatorio en el código y opcional en el contrato.** Ya está en `PERMITIDAS` con su motivo: mientras no exista token del que derivarlo no hay opción, y cuando exista la excepción se borra.

## 2026-10-02 — M1, M2 y M3 contra el árbol real, y los .docx al día

**Rama:** `capas-en-todo-el-backend` — **Commits:** este bloque y el de documentación

### Los tres planes tenían la misma herida que M4

M4 ya estaba reescrito. M1, M2 y M3 seguían describiendo la arquitectura de ports, tokens y adapters que el código abandonó. El trabajo fue el mismo, plan por plan, y en los tres la decisión que mandaba sobre todo era la misma:

- **M1** (§2 decisión 1, §2 decisión 2, §3.3, §4, §5, §6, ADR y cronograma): la decisión de capas pedía `repositories (interfaz + InjectionToken string) → adapters de Prisma` y la decisión 2 publicaba dos tokens desde un `UsuariosModule` `@Global()`. Hoy no hay interfaz de repository, ni token, ni `repositories/prisma/`, y `UsuariosModule` no es `@Global()`: exporta `MembresiasService` y `SociosService`, y los módulos vecinos lo importan.
- **M2** (§2 decisión 4 y decisión 6, §3, §4.2, §5.1, §5.2): el acceso a la vigencia de M1 era `MEMBERSHIP_VALIDATION_PORT` con adaptador e inyección `@Optional()` sin importar el módulo. Ahora `GimnasioModule` importa `UsuariosModule` y pide `MembresiasService`. El **fail-closed se mantiene**: sin vigencia no entra, 403.
- **M3** (§2 decisión 1 y decisión 4, §3, §4.1, §4.2, §4.3): los puertos eran `MEMBERSHIP_VALIDATION_PORT`, `CONSULTA_SOCIO_PORT` y `ConsultaSocioPort` "ampliado" para el email del aviso. Ahora `ClasesModule` importa `UsuariosModule` y `GimnasioModule` y pide `MembresiasService`, `SociosService` y `SedesService`.

Cada decisión corregida quedó anotada con qué decía antes y por qué cambió, en vez de borrarse, para que se vea que hubo una decisión y no un descuido. Igual que en M4.

### El `@Optional()` disappearance mejoró la seguridad de M3

Al reescribir contra el código apareció que la dependencia opcional era un agujero, no solo una comodidad de DI. Los comentarios del propio código lo dicen: en `EsperasClasesService` y `ReservasClasesService` toda la validación de vigencia estaba dentro de `if (this.membresias)`, así que **sin M1 registrado la reserva bonificada pasaba sin comprobar RN-03** y la anotación a lista de espera entraba sin validar. En `ClasesService` el mismo patrón permitía crear una clase con una sede inexistente si M2 no estaba dado de alta. Con servicios concretos las tres dependencias pasaron a obligatorias y los tres `if` desaparecieron.

### Conteo de e2e corregido

`m1.e2e-spec.ts` tiene 12 casos, no 9: los 9 del módulo más 3 de regresión del body `{}` en PATCH. Los cuatro planes quedaron con el total real (12 + 15 + 20 + 36 + 7 + 8 = **98/98**) en vez del 95/95 que aún decía M4.

### Los .docx se regeneraron, y el generador quedó guardado

El `.md` es la fuente y M4 lo declara explícitamente ("se genera a partir de él, mismo generador que los planes M1–M5"), pero **el generador no existía como archivo**: la conversión anterior se había hecho con un script en línea. Para poder uphold esa regla sin editar el `.docx` a mano, quedó en el vault como `md2docx_plan.py` (python-docx, que ya estaba instalado; no hay `pandoc` ni `md2docx` en la máquina y `npx md2docx` no resuelve).

Se validó contra el `.docx` de M4 que ya existía: Regenerar el archivo da **27 diferencias y todas son las correcciones de esta entrada**, con **0 bloques de texto igual pero estilo distinto**. Eso confirma que el generador reproduce las convenciones del anterior: `## → Heading 1`, `### → Heading 2`, `> → Intense Quote`, `N. → List Number`, `N) → List Number 2`, tablas `Light Grid Accent 1`, `inline → Consolas 9,5pt` y bloques ```` ``` ```` en `Consolas 9pt`.

Tres defectos del generador aparecieron al validarlo y quedaron corregidos:

- **Código inline dentro de negrita salía literal.** Un tramo `**texto con `código`**` se consumía entero como negrita y los backticks quedaban impresos. Se reemplazaron las dos pasadas de regex por un escáner recursivo que resuelve código y marcado en el mismo recorrido.
- **Soft wrap partía párrafos.** Las líneas consecutivas de prosa son un solo párrafo en markdown, pero cada una salía como párrafo propio: en M2 un solo texto quedaba en cuatro fragmentos. Ahora se unen.
- **El `>` de las citas nuevas quedaba impreso en mitad del párrafo.** `texto. > **Corrección**` no es markdown válido. Se corrigió en los `.md`, que son la fuente: el `>` abre línea propia y el conversor lo reconoce como `Intense Quote`. Eran 12 casos en los cuatro planes.

**M1, M2 y M3 no tenían `.docx`:** solo M4 estaba convertido. Se generaron los tres, y el de M4 quedó con copia `M4.docx.bak-20261002-031122` del anterior.

### Verificación

- Barrido de los cuatro `.md` contra el vocabulario de la arquitectura vieja: **0 referencias activas**. Las que quedan están dentro de notas que explican qué cambió.
- Codificación: los cuatro `.md` y los cuatro `.docx` abren bien, sin `U+FFFD` y sin marcadores de markdown sin parsear.
- Estructura de los `.docx`: los cuatro con `Title`, `H1`, `H2`, viñetas, listas numeradas, sub-listas, citas y sus dos tablas.
- El generador es idempotente: dos corridas seguidas dan el mismo contenido.

### Pendientes que siguen abiertos

1. **M5 no tiene comportamiento.** Sin cambios respecto de la entrada anterior.
2. **`PICO_RECARGO_PCT = 20`** sigue pendiente de confirmación con la cátedra. Vive aislado en `pricing-constants.ts` con el comentario que lo declara, así que cambiarlo es una línea.
3. **No se valida el turno contra el horario de la sede** porque ese dato no existe en el modelo. Deuda asumida a propósito (decisión 11 del plan M4).
4. **`ReservaCanchaIn.usuario_id` es obligatorio en el código y opcional en el contrato.** Es una desviación real y deliberada: mientras no exista token del que derivarlo no hay opción, así que el DTO lo exige. Cuando exista el token, el contrato se respeta tal cual.
5. **El ADR del vault nunca quedó desactualizado, y se verificó.** Al revisar los cuatro planes encontré una nota en el plan M1 que decía que `TFI FitZone - Definicion Tecnica.md` "quedó desactualizada" con la migración a capas, y la repetí aquí como deuda sin comprobarla. Era falsa: ADR-07 ya decía que los repositorios "son **clases concretas** que reciben el `PrismaService` por constructor" y que "no hay una interfaz por repositorio ni un token de inyección", y ADR-09 ya documentaba el paso de la dependencia opcional a la obligatoria declarada en el `imports`. Al fechar la nota, ADR-07 marca la revisión de implementación el 1 de Octubre, el mismo día de la migración. Barrido de los once `.md` del vault con `_PORT`, `_REPOSITORY`, `_TOKEN`, `.port.ts`, `prisma-*.repository`, `@Global()` y `Mediador`: las únicas coincidencias son las notas de corrección de los propios planes, dos variables de entorno reales (`MP_TOKEN`, `qr_token`) y el apartado de C4 que explica por qué el diagrama ya no tiene componente Mediador. `Diagramas C4` y `Unidad II - Backend` también estaban ya alineados. Se corrigió la nota del plan M1 y este punto. **Sin deuda en el documento técnico.**
6. **Los planes viven fuera de Git.** Este LOG es lo único que deja rastro en el historial de los cambios de documentación; los `.md` y los `.docx` del vault no versionan.
7. **La comparación automática de contrato no viaja en el repo, pero sigue en local.** Ver la entrada siguiente: `backend/contrato/` deja de ser trackeado y queda en `.gitignore`, y se genera el YAML desde `/docs-json`. Quien clonee no la tiene; la desviación del punto 4 queda sin herramienta que la detecte.

---

## 2026-10-02 — Se saca la parte de contrato del repo

**Rama:** `capas-en-todo-el-backend` — **Commits:** este bloque y el de documentación

### Qué sale del repo

El contrato no se versiona. El YAML que se entrega sale de `/docs-json` del backend, que es el mismo documento que ya publica NestJS. `backend/contrato/` deja de ser trackeado: se saca del índice con `git rm --cached`, se deja el directorio en disco y se agrega `/contrato/` al `.gitignore`, así que sigue funcionando para comparar pero no aparece en el status ni viaja en un clone. También se sacan los cuatro scripts de `package.json` (`test:contrato`, `test:contrato:diff`, `contrato:exportar`, `contrato:verificar`) y la línea del árbol en `backend/README.md`.

Los scripts se sacan a propósito y no es un descuido: un `npm run` que apunta a una carpeta que el repo no tiene le rompería el comando a cualquiera que clonee, con un error de "config no encontrado" que no dice nada sobre la causa. La herramienta local se corre con `npx`, y su propio README documenta los comandos exactos.

### Qué no se toca

El backend. `@nestjs/swagger`, `swagger-ui-express`, los decoradores de los controllers, `main.ts` con su `DocumentBuilder` y `src/commons/swagger/` siguen exactamente igual, porque de ahí sigue saliendo el documento. Los comentarios del código que dicen "el contrato declara 422" o "el contrato define el filtro `fecha`" también se quedan: describen la especificación que el código implementa, no la herramienta que la comparaba.

`js-yaml` vuelve a `devDependencies`: la herramienta local lo importa directo, y dejarlo solo como transitive de `@nestjs/swagger` sería una dependencia no declarada que funciona por casualidad.

### Por qué se acepta la pérdida

Lo que se pierde es la detección **automática y para todos**. El comparador era lo único que decía por su cuenta si el código divergía de la especificación: un DTO al que se le olvidó un campo, un status que quedó en 400 donde la especificación pide 422, un parámetro de ruta con otro nombre. Quien clonee el repo ya no lo tiene; hay que hacerlo a mano contra `/docs`. Se acepta porque el contrato es un entregable, no una frontera: no hay un cliente externo cuya rompa dependa, y el alcance real de la API está en el código.

Lo que la herramienta conserva y el repo no, es la lista de desviaciones aceptadas a propósito, que vivía en `PERMITIDAS`. Quedan registradas acá las dos categorías: los enums con nombre en el contrato que el código emite inline (`Rol`, `Plan`, `EstadoMembresia`, `EstadoCancha`, `EstadoEspera`, `EstadoReserva`, `EstadoReservaClase`, `TipoCancha`) y el `usuario_id` del punto 4.

### Verificación

`tsc --noEmit` y `build` en verde. Unitarios 20/20. E2e 98/98. Los 32 tests de contrato quedan fuera de `npm run`, pero siguen funcionando localmente: 29/29 sin servidor y el diff 3/3 con 41 operaciones y 34 schemas, 0 diferencias.

**Commits:** este bloque y el de documentación.

---

## 2026-10-02 — La rama de capas entra a `main` y se borra

**Rama:** `capas-en-todo-el-backend` → `main` — **Commits:** 21, en fast-forward

### Cómo se integró

`main` (`325f386`) era ancestro directo de la punta de la rama, así que la integración es **fast-forward**: no hay commit de merge, no hay conflictos que resolver y no hay reescritura de historia. `git merge --ff-only` a propósito, para que si `main` se hubiera movido entre la verificación y la ejecución el merge abortara en vez de crear un commit que nadie pidió.

Verificado antes de integrar: `main` local y `origin/main` estaban los dos en `325f386`, sin divergencia; `git push --dry-run` de la rama a `main` fue aceptado, así que no hay branch protection que bloquee; y los 21 commits son de un solo autor, `Exequiel-Ansaldi <exeansaldi0@gmail.com>`, sin trabajo de terceros en la rama.

### Qué entra a `main`

Los 21 commits, agrupados por lo que hacen:

- **Migración a capas** de los cinco módulos: `026c0bb` (M1), `cc87947` (M2), `29dab5c` (M3), `7104351` (M4), `d8f5165` (M5). Cada uno cierra su puerto, token o bypass y deja repositorios concretos.
- **Invariante de membresía obligatoria**: `eefefc6` (`feat(m1): exige el plan y crea la membresia junto con el socio`) y su nota de LOG `d7c4719`. **Este commit vivía solo en la rama, no en `main`**, así que el merge es lo que lo integra.
- **Andamiaje de M5**: `d944582`, que completa la frontera interna de pagos.
- **PATCH con body vacío**: `2934da1` rechaza `{}` con 422 en los tres endpoints de M1, y `54baddb` declara el 422 del listado y el PATCH vacío de M4. Prisma 6.19.3 los habría tratado como no-op 200.
- **Contrato**: `5091bb9` lo puso canónico en el repo, `4ff9f7b` lo registró, `f3e3ee7` lo sacó y `f2e0f21` dejó la herramienta local sin trackear.
- **Documentación**: el cierre del Mediador (`6e7a87c`), el árbol real en el README (`2a0c868`), la hipótesis falsa del 500 (`f2b87ab`), los tres planes contra el árbol real (`c99a658`), la deuda falsa del ADR (`b5395a2`) y la salida del contrato (`3767d99`, `437fbd6`).

89 archivos, +2743 / −2136.

### Qué queda fuera, a propósito

- **El `.gitattributes` de UTF-8** vive en `gonza/consistencia-naming-listados` (`5d9c97f`) y **no** entró: esa rama está 71 commits atrás de la ours. Sigue pendiente para otro momento.
- **`backend/contrato/` no entra.** Es lo que se decidió en la entrada anterior: la herramienta queda en el disco, ignorada, y el entregable sale de `/docs-json`.
- Las otras ramas no se tocaron: `backup/pre-m4-b3-20261001` y `gonza/consistencia-naming-listados` en local, y `origin/santino`, `origin/santiago`, `origin/exe`, `origin/gonza`, `origin/desarrollo-m3`, `origin/santirayn` en el remoto. Las dos locales están 0 commits adelante de la rama integrada, así que no tienen nada único.

### La rama se borra

Local y remota, como se pidió. Se borró después de confirmar que `main` ya tenía los 21 commits, así que la rama no era la única copia de nada.

**El PR #2 queda moot**: al recibir los commits, `main` los contiene, así que GitHub lo marca como mergeado; al borrar la rama remota, queda cerrado. El cambio ya no entra por ese canal.

### Verificación

Sobre la rama, antes de integrar: `tsc --noEmit` y `build` en verde, unitarios 20/20, e2e 98/98 en 6 archivos, y la herramienta local de contrato 29/29 sin servidor más el diff 3/3 con 41 operaciones y 34 schemas y 0 diferencias.

Sobre `main`, ya con el checkout hecho y antes de borrar la rama: se repitieron `tsc --noEmit`, `build`, unitarios y e2e para confirmar que el árbol final sirve y no solo el de la rama.

**Estado final:** `origin/main` y `main` local en el mismo SHA, la rama ausente de los dos lados, working tree limpio, y `backend/contrato/` en disco con sus 15 archivos.

---

### Semana 4 · SCRUM-11 — M5 Pagos y Facturación (Bloque 0: dominio y cableado)

**Fecha:** 02/10/2026 — **Rama:** `m5-pagos`

#### Tareas finalizadas

1. **Precio de membresía en la tabla (M1)**
   - Columna `precio Decimal(65,30)` en `Membresia`, migración `20261002010000_membresia_precio` con backfill:
     `MENSUAL=30_000`, `TRIMESTRAL=80_000`, `ANUAL=280_000` ARS.
   - `MembresiaOut` sigue lista blanca (`@Exclude` clase + `@Expose` campos) → `precio` no sale por la API.
   - `moneda` solo ARS, validado con `@IsIn(['ARS'])` sin `enum` en Swagger para no mover el contrato.

2. **PATCH de membresía: fechas + precio atómicos (M1)**
   - `MembresiaRepository.actualizar`: al enviar `plan` se re-precia Y se escriben `fecha_inicio` y `fecha_fin` juntas con `calcularVigencia(plan, new Date())`. El periodo nuevo arranca HOY; los días del periodo anterior no se trasladan.
   - Descripción canónica replicada en `@ApiOperation.description` Y en `contrato/openapi.yaml` (ambos lados idénticos).

3. **Exports angostos para que M5 lea sin consultar tablas ajenas (ADR-07)**
   - `M1/MembresiaPrecioService`: devuelve `membresia_id, usuario_id, plan, precio(number), estado` haciendo join `Membresia→Socio` (solo M1 puede hacerlo).
   - `M4/ReservaPrecioService`: devuelve `reserva_id, usuario_id, precio_aplicado, estado` (M4 dueña de la tabla).
   - Ambos con tests de unidad (3 + 3) y propagación de `null` para que M5 traduzca a 404 con su propio problem type.

4. **M5 PagosModule cableado en el grafo**
   - Importa `UsuariosModule` y `CanchasModule`, expone nada todavía (los endpoints llegan en B1).
   - `AppModule` importa `PagosModule`; tag `pagos` pospuesto a B1 (evita tag vacío en Swagger).
   - Los cuatro `.gitkeep` se conservan (carpetas M5 aún vacías).

5. **Fixtures e2e (M2/M3/M4) actualizados** con `precio: PRECIOS_PLAN.MENSUAL` en inserts directos de `Membresia`.

6. **Nuevo e2e**: cambio de plan mueve precio y las DOS fechas, cambio inmediato (falla si se ancla en `fecha_fin` anterior).

7. **Contrato exportado al vault** (`npm run contrato:exportar`): `openapi.yaml` → `TFI FitZone - OpenAPI.yaml`.

#### Decisiones tomadas

1. **M5 resuelve el monto leyendo M1/M4** (opción recomendada). El cliente no manda `monto` (`additionalProperties: false`); M5 congela el precio que leen los exports.
2. **Renovación automática (RF-02) se hará en M5 (B6)** con `RenovacionesCron`, `listarParaRenovacion()`, `prorrogar()`. `ScheduleModule.forRoot()` se moverá a `AppModule`.
3. **`SolicitudCobro` pierde `monto` en B6**; su comentario obsoleto se arregla ahí.

#### Problemas encontrados

1. **Fixture roto**: los inserts Prisma en M2/M3/M4 fallaban por `NOT NULL precio` → agregado `PRECIOS_PLAN.MENSUAL` + import.
2. **Unit test de M1** (`membresias.service.spec.ts`) fallaba por `precio` requerido en la factory `membresiaValida()` → agregado.
3. **Vault canónico desincronizado** tras editar `openapi.yaml` → `exportar.ts` vuelve a alinearlo.
4. **Diff de contrato requería backend levantado** en `localhost:3000/docs-json` → `npm run start:prod` en background para el test.

#### Commits

- **feat(m5): B0 — cableado y dominio del módulo de pagos** → [commit 64323b1](https://github.com/GonzaloVila/FitZone-Sports/commit/64323b1)
- **docs(log): B0 — bitácora del Bloque 0** → [commit b673524](https://github.com/GonzaloVila/FitZone-Sports/commit/b673524)

### Semana 4 · SCRUM-11 — M5 Pagos y Facturación (Bloque 1: concepto de pago e idempotencia)

**Fecha:** 02/10/2026 — **Rama:** `m5-pagos`

#### Tareas finalizadas

1. **Entidades de dominio**: `PagoNuevo` (sin `id` ni `estado`: el estado se escribe explícito y arranca `PENDIENTE`) y `PagoAAnular` (la anulación se pide sobre el pago, no sobre un id suelto, porque la devolución necesita `token`, `monto` y `moneda`).
2. **`PagoRepository`**: `crear()` inserta el pago y su subtipo en **una sola sentencia anidada** (herencia parte-todo) y traduce `P2002` a motivo de dominio · `buscarPorId()` · `anular()` con el filtro por estado en el propio `UPDATE` (dos anulaciones simultáneas no ganan las dos).
3. **`PasarelaPagoService`**: mock determinista por prefijo de token (`tok_aprobado` → APROBADO, `tok_pendiente` → PENDIENTE, resto → RECHAZADO) y `reembolsar()` para la anulación.
4. **DTOs**: `PagoIn` con el `oneOf` de `ConceptoPago` traducido a runtime y `token` `writeOnly`; `PagoOut` lista blanca **sin** `token`.
5. **Deuda técnica del precio de membresía (decisión 5 del plan)**: resuelta en el Bloque 0 con la columna `precio`.
6. **Sin migración**: los tres modelos (`Pago`, `PagoReserva`, `PagoMembresia`) y `Pago.fecha_pago` ya existían.

#### Decisiones tomadas

1. **Los dos `@unique` de M5 no se colapsan en un motivo.** `Pago.idempotencia_key` → `IDEMPOTENCIA_REPETIDA` (el reintento del cliente, que es lo que el contrato llama `IdempotenciaRepetida`); `PagoReserva.reserva_id` → `RESERVA_YA_COBRADA` (cobrar dos veces la misma reserva, que no es idempotencia y cuyo detalle no puede decir "ya existe un pago con esa Idempotency-Key"). El default ante un `@unique` desconocido es `IDEMPOTENCIA_REPETIDA`, porque es el motivo que el contrato ya declara para este endpoint.
2. **La selección de proveedor por `NODE_ENV` (decisión 9) se difiere.** La frontera quedó en el lugar que la decisión protege —dentro de `PasarelaPagoService`, invisible para `PagosService`— pero escribir un `switch` cuyas dos ramas dan lo mismo con un solo proveedor es peor que no tenerlo. Cuando exista el proveedor real, la selección va en el constructor de esa clase.
3. **El `oneOf` del contrato se modela como una clase con los dos ids opcionales más un `ValidatorConstraint`**, porque `class-validator` no tiene unions discriminadas. Sin esa regla, `{tipo: MEMBRESIA, reserva_cancha_id: 7}` pasaba los decoradores de campo y el service no sabía qué cobrar.

#### Problemas encontrados

1. **`@Validate(Clase)` con método estático `validate` no validaba nada**: devolver un string desde el método se interpretaba como "válido" (truthy) y la regla del `oneOf` pasaba siempre en verde. Se rehízo con `registerDecorator` + `ValidatorConstraintInterface`.
2. **`ValidatorConstraint` no sirve como decorador de propiedad** (su retorno está tipado como decorador de clase) y `@ConceptoUnico()` no compilaba. Resuelto con `registerDecorator`.
3. **Faltaba `@IsDefined()` en `concepto`**: `@ValidateNested` solo recorre el objeto si viene, así que un body `{}` pasaba la validación y el service recibía `undefined` en vez de un 422.
4. **`moneda` rechazaba el body sin él**: `@IsIn(['ARS'])` corre contra `undefined`. El contrato la declara con `default: ARS` fuera de `required`, así que omitirla es el caso normal; se agregó `@IsOptional()` siguiendo la convención de los DTOs de filtro.
5. **El constraint crasheaba con `TypeError` ante un body `{}`** y eso se convertía en 500 en vez de 422.

#### Verificación

`npx prisma validate` y `npm run build` en verde; unitarios **50/50** (24 nuevos: 6 de la pasarela, 13 del repositorio, 7 del DTO); e2e **99/99** sin regresiones; contrato local **29/29**.

#### Commits

- **feat(m5): B1 — concepto de pago, idempotencia y pasarela simulada** → [commit 0a38fd0](https://github.com/GonzaloVila/FitZone-Sports/commit/0a38fd0)
- **docs(log): B1 — bitácora del Bloque 1** → [commit 6bc82d8](https://github.com/GonzaloVila/FitZone-Sports/commit/6bc82d8)

### Semana 4 · SCRUM-11 — M5 Pagos y Facturación (Bloque 2: cobro por HTTP)

**Fecha:** 03/10/2026 — **Rama:** `m5-pagos`

#### Tareas finalizadas

1. **`PagosService.procesarPago()`** con el orden que cierra la ventana de idempotencia: resolver el concepto (404 si no existe) → copiar el monto de M1/M4 → insertar el pago `PENDIENTE` → cobrar → transicionar.
2. **`PagosController`** con `POST /pagos`: exige `Idempotency-Key`, responde 201 con `Location` y declara los cinco 4xx del contrato.
3. **`PagoRepository.transicionar()`** para llevar el pago a `APROBADO` o `RECHAZADO`.
4. **Cuatro factories de error nuevas** (`faltaIdempotencyKey`, `pagoRechazado`, `idempotenciaRepetida`, `reservaYaCobrada`) con los `type`/`title` literales del contrato.
5. **`conceptoDePago()`**: traducción del objeto validado a la unión del dominio, en el DTO y al lado del constraint.
6. **`marcarSchemasDePagos()`**: post-proceso del documento para publicar `ConceptoPago` y `EstadoPago` como schemas con nombre y referenciarlos desde `PagoIn`/`PagoOut`.
7. **Cableado**: controller y services en `PagosModule`, tag `pagos` en `main.ts`, y borrado de los cuatro `.gitkeep` que quedaron sin uso.

#### Decisiones tomadas

1. **Insertar el pago ANTES de cobrar** (decisión 6 del plan, implementada acá). Es lo que hace que un `@unique` reventado devuelva 409 sin haber tocado la pasarela: al revés, el 409 llega después del cobro y el cliente no sabe si le cobraste.
2. **El rechazo de la pasarela responde 402 pero el pago queda persistido como `RECHAZADO`.** Es un resultado de negocio, no un error de transporte: entra al histórico y se puede reintentar con una clave nueva. Borrarlo tiraría abajo el registro de un cobro que la pasarela efectivamente rechazó.
3. **El 400 por falta de `Idempotency-Key` va en el controller.** Es transporte y el `ValidationPipe` no ve headers; sin ese check el service recibiría `undefined` y el `@unique` de Prisma respondería 500.
4. **El 404 es "no existe", no "no se puede cobrar".** Una reserva `CANCELADA` o una membresía no `ACTIVA` existen, y el contrato no declara ninguna respuesta para "existe pero no es cobrable". Agregar un 422 ahí sería inventar contrato; queda como deuda hasta que el contrato lo declare.
5. **`solicitarCobro()` se difiere al Bloque 6.** Su único llamador futuro es el cron y su firma depende de los cambios que B6 le hace a `SolicitudCobro` (que le saca `monto`). Escribirla ahora es escribir código muerto con una forma que va a cambiar.
6. **El `oneOf` del contrato se publica por post-proceso y no por decorador.** Un decorador no puede emitir un schema cuyo cuerpo sea un `oneOf`; `marcarSchemasDePagos()` sigue la convención que ya tenía `markRequestSchemasClosed()`.

#### Problemas encontrados

1. **Faltaba `@IsOptional()` en los dos ids del concepto** (mismo patrón que `moneda` en B1): el id ausente de la rama no elegida dispara `@IsInt(undefined)` y TODO body bien formado daba 422. Lo encontró el e2e.
2. **El unitario no podía ver ese bug.** El helper `errores()` del spec leía solo `ValidationError.constraints` del root, pero los errores de `@ValidateNested()` viven en `children`: devolvía `[]` para cualquier body mal formado. El test que se suponía cubría el caso pasaba por el mensaje del `oneOf`, que menciona `membresia_id` de paso. Corregido y verificado en las dos direcciones: sin el `@IsOptional()` el spec da 2 fallos.
3. **El diff contractual bajó de 21 hallazgos a 5 y de ahí a 0, y dos de los intermedios eran bugs reales míos**: al quitar el `@ApiProperty()` de `concepto` la propiedad desapareció del documento entero, y como el plugin del CLI de Swagger no está activo en este proyecto, Nest marca como required todo lo que no lleve `@ApiPropertyOptional()` — por eso `moneda` y `comprobante_pdf_url` aparecían en el `required` que el contrato no pide.
4. **El 402 se había olvidado en la primera pasada del controller**; el comparador contractual lo saltó.
5. **El constraint crasheaba con un body `{}`** y eso terminaba en 500 en vez de 422 (mismo fix que B1, reaplicado al tocar el archivo).

#### Verificación

`npx prisma validate` y `npm run build` en verde; unitarios **64/64** (14 nuevos); e2e **113/113** (14 nuevos, todos de M5); contrato local **29/29**; diff contra el vault **3/3** con `POST /pagos` ya en alcance.

#### Commits

- **feat(m5): B2 — cobro por HTTP (POST /pagos)** → [commit 9f7e850](https://github.com/GonzaloVila/FitZone-Sports/commit/9f7e850)
- **test(m5): el helper de errores solo miraba el nivel superior** → [commit 495fa24](https://github.com/GonzaloVila/FitZone-Sports/commit/495fa24)
- **docs(log): B2 — bitácora del Bloque 2** → [commit df5627b](https://github.com/GonzaloVila/FitZone-Sports/commit/df5627b)

### Semana 4 · SCRUM-11 — M5 Pagos y Facturación (Bloque 3: comprobante en PDF)

**Fecha:** 03/10/2026 — **Rama:** `m5-pagos`

#### Tareas finalizadas

1. **`ComprobantesService`** (nuevo): arma el PDF con pdfkit y lo deja escrito en `storage/comprobantes/`, y lo vuelve a leer. Es la tercera frontera del módulo y la única que no habla con nadie: pdfkit no hace red.
2. **`GET /pagos/{pago_id}/comprobante`**: sirve el archivo con `StreamableFile`, `Content-Type: application/pdf` y `Content-Disposition` con el nombre `comprobante-pago-{id}.pdf`.
3. **El snapshot se arma en el cobro, no en la descarga.** `PagosService` llama a `generar()` recién después de la transición a `APROBADO` y persiste la ruta con `PagoRepository.registrarComprobante()`; el endpoint solo lo lee.
4. **`pagoNoAprobado()`**: factory de error para el 409 con el `type`/`title` literales del contrato.
5. **`ReservaPrecioService.obtenerParaCobro()`** ampliado con `cancha_id`, `fecha_hora_inicio` y `fecha_hora_fin`.
6. **8 unitarios nuevos de `ComprobantesService` y 8 de `PagosService`**, más 7 e2e del flujo completo.

#### Decisiones tomadas

1. **El comprobante se genera una sola vez, al aprobarse el pago.** El plan pide "generar/retornar", pero regenerarlo en cada request haría que un comprobante ya emitido cambiara si después cambió el horario de la cancha o la tarifa — que es justo lo que un comprobante no puede hacer. Es la misma razón por la que M4 congela `precio_aplicado`: el archivo es el snapshot, y `comprobante_pdf_url` existe para que la descarga no tenga que reconstruirlo.
2. **La columna guarda la ruta pública (`/storage/comprobantes/8.pdf`), no un `file://` de esta máquina.** Si mañana el PDF pasa a un bucket, la columna ya contiene la clave del objeto y no hay que backmigrar rutas absolutas.
3. **pdfkit y el disco local, por decisión del equipo.** La librería entra adentro de `ComprobantesService` y no se filtra: el service expone `Buffer` y ruta, nunca un `PDFDocument`, así que cambiar de librería es cambiar ese archivo y `PagosService` no se entera.
4. **El directorio NO es público ni se sirve con `ServeStatic`.** El PDF solo baja por el endpoint, que antes valida que el pago esté aprobado: un comprobante de cobro no debería ser adivinable por quien sepa el id.
5. **El PDF se genera sin compresión.** Pesa un poco más y a cambio el texto se puede leer y verificar en los tests; para un ticket de una hoja el tamaño no es un problema.
6. **`generar()` devuelve la ruta y no `Buffer`.** El plan escribe `Promise<Buffer>`, pero el servicio escribe el archivo, así que la ruta es lo que el caller necesita persistir; el `Buffer` es interno. La firma literal del plan se cambió por esta, y el `armarPdf()` privado es el que devuelve `Buffer`.
7. **`ReservaPrecioService` se amplía en vez de abrir un segundo export.** El comprobante necesita cancha y horario, y el cobro ya lee esa misma fila: una segunda lectura por PK de la misma fila no es una violación de la separación entre módulos, y evita que M5 arme una unión de dos tipos de dos módulos distintos.

#### Problemas encontrados

1. **`import PDFDocument = require('pdfkit')` compilaba pero reventaba los e2e.** `tsc --noEmit` y el runner de unitarios lo aceptan; el de e2e usa SWC con salida ESM y ahí un import assignment es un error de sintaxis. Como el PDF solo se exercise de verdad por HTTP, el bug no apareció hasta los e2e. Ahora es `import PDFDocument from 'pdfkit'`, que anda en los tres.
2. **El diff contractual marcó `pago_id` como `number` donde el contrato declara `integer`.** Es la primera vez que se comparaba un path param de M5 (el `GET /pagos/{pago_id}` del detalle todavía está fuera de alcance), así que la omisión pasó inadvertida: faltaba el `@ApiParam({ type: 'integer' })` que llevan los ids de los demás módulos. Se corrigió en el controller en vez de declararlo como diferencia aceptada: acá el documento es el que estaba incompleto.
3. **El test unitario de M4 avisó del cambio de contrato del export.** Al ampliar `obtenerParaCobro()`, el `toEqual` exacto del spec falló. Se actualizó y se agregó un test que fija cancha y horario, que es lo que impide que alguien recorte esos campos pensando que son de M5.
4. **Los e2e de B2 dejaron PDFs tirados en el repo.** Al pasar a aprobarse el cobro con comprobante, los tests de RF-13 que ya pasaban empezaron a generar archivos que nadie borraba. La limpieza dejó de ser una lista de ids por test y pasó a ser una consulta de los pagos del fixture antes de borrar la base: con lista manual, el próximo test que apruebe un pago y olvide la línea vuelve a ensuciar el repo.

#### Verificación

`npx prisma validate` y `npm run build` en verde; unitarios **84/84** (20 nuevos); e2e **120/120** (7 nuevos, todos de M5); contrato local **29/29**; diff contra el vault **3/3** con `GET /pagos/{pago_id}/comprobante` ya en alcance y **0 diferencias**.

#### Commits

- **feat(m5): B3 — comprobante en PDF (GET /pagos/{id}/comprobante)** → [commit ebc3772](https://github.com/GonzaloVila/FitZone-Sports/commit/ebc3772)
- **test(m5): el PDF se verifica por dentro, no por su firma** → [commit 8f68a72](https://github.com/GonzaloVila/FitZone-Sports/commit/8f68a72)
- **docs(log): B3 — bitácora del Bloque 3** → [este commit]

### Semana 4 · SCRUM-11 — M5 Pagos y Facturación (Bloque 4: listado, consulta y anulación)

**Fecha:** 03/10/2026 — **Rama:** `m5-pagos`

#### Tareas finalizadas

1. **`GET /pagos`**: listado con siete filtros en lista blanca (`usuario_id`, `estado`, `tipo`, `reserva_cancha_id`, `membresia_id`, `desde`, `hasta`) más paginación (`page`, `per_page`). Sin `estado` devuelve solo `APROBADO` (negocio, no DTO ni repositorio). Fechas inclusivas (`rangoDelDia`).
2. **`GET /pagos/{pago_id}`**: detalle por id, sin `token` ni `idempotencia_key`.
3. **`POST /pagos/{pago_id}/anulaciones`**: única forma de pasar un pago a `ANULADO`. `RECHAZADO` → 409 `PagoNoAnulable`; `ANULADO` → 204 idempotente; `PENDIENTE`/`APROBADO` → transición atómica en el repositorio; `APROBADO` invoca `reembolsar()`.
4. **`PagoRepository.listar()`**: método nuevo con filtros combinables, subtipo→relación (RESERVA_CANCHA ↔ `pago_reserva: { isNot: null }`, `pago_membresia: { is: null }`), paginación `skip`/`take`, orden estable `(fecha_pago desc, id desc)`.
5. **`pagoNoAnulable()`**: factory de error 409 con `title: 'Pago no anulable'` y `detail` literal del contrato.
6. **34 unitarios nuevos** (`PagosService` + repository + DTO de query) y **15 e2e** (listado, consulta, anulación y su контракт).

#### Decisiones tomadas

1. **`ListarPagos` con `desde`/`hasta` como `string` y no `Date`**: el DTO recibe strings (`YYYY-MM-DD`), el service los traduce a instantes con `rangoDelDia()`. Es la misma separación que en M4 (`fecha?: string` en el service, `Date` solo en el repositorio).
2. **El default de `estado` vive en el service, no en el DTO ni en el repositorio**: el DTO valida lo que recibe, el repositorio filtra sin defaults, y la regla de negocio ("sin estado = solo APROBADO") esowned by el service.
3. **El `tipo` filtra por la relación, no por una columna de `Pago`**: `RESERVA_CANCHA` se traduce a `pago_reserva: { isNot: null }, pago_membresia: { is: null }`. Un pago de membresía tiene `pago_membresia` lleno y `pago_reserva: null`; sin el desempate, un filtro solo por `pago_reserva: { isNot: null }` traería ambos tipos.
4. **`anular()` del repositorio filtra por estado en el propio `UPDATE`**: `UPDATE … WHERE id = ? AND estado IN ('PENDIENTE', 'APROBADO')`. Dos llamadas simultáneas no pueden ganar las dos; la segunda recibe `null` (Prisma `P2025`) y el service deriva 409 `RECHAZADO`.
5. **`reembolsar()` se invoca solo si el pago estaba `APROBADO`**: un `PENDIENTE` nunca se cobró, así que no hay contra qué devolver. La semántica "si corresponde" del plan se interpreta así.
6. **El `until` inclusivo se implementa con `[gte, lt)`**: `rangoDelDia(fecha)` devuelve `{ desde: inicio(fecha), hasta: inicio(fecha + 1 día) }`. Esto incluye el día pedido entero y excluye el siguiente, que es lo que dice el contrato (`?desde=2026-03-01&hasta=2026-03-31` trae todo marzo).

#### Problemas encontrados

1. **Los tests de listado usaban la misma `reservaId` para dos cobros**: `cobroReserva(reservaId, clave1)` + `cobroReserva(reservaId, clave2)` genera la segunda reserva con la misma `(usuario_id, fecha_hora_inicio)` y el `UNIQUE` de `Reserva` rechaza el insert. Los tests que no reusaban `reservaId` pasaban. Se separaron en dos `crearReserva()` por test.
2. **`ListarPagos` declaraba `desde/hasta` como `Date` pero el controller pasa strings**: el DTO tiene strings (`YYYY-MM-DD`), `ListarPagos` los redeclara como `string` con `Omit<FiltrosListarPagos, 'desde' | 'hasta'>`, y el service los convierte. Sin el `Omit`, `FiltrosListarPagos` ya exigía `Date` y `tsc` lo rechazaba.
3. **La inserción de métodos en `pagos.service.ts` falló dos veces**: el texto buscado era `RF-14: servir…` pero el archivo dice `RF-13: servir…` (comprobante). Se usó el texto exacto del archivo y se fijó el comentario a `RF-14`.

#### Verificación

`npx prisma validate` y `npm run build` en verde; unitarios **118/118** (34 nuevos); e2e M5 **36/36** (15 nuevos); contrato local **29/29**; diff contra el vault **0 diferencias**, **0 operaciones fuera de alcance**.

#### Commits

- **feat(m5): B4 — listado, consulta y anulación de pagos (RF-10/11/12)** → [commit 0eadd1d](https://github.com/GonzaloVila/FitZone-Sports/commit/0eadd1d)
- **fix(m5): require pdfkit instead of ES default import** → [commit f04860d](https://github.com/GonzaloVila/FitZone-Sports/commit/f04860d)

---

### Semana 4 · SCRUM-11 — M5 Pagos y Facturación (Bloque 5: QA, integración y cierre)

**Fecha:** 03/10/2026 — **Rama:** `m5-pagos`

#### Verificación final

- `npm run build` y `npx tsc --noEmit` en verde.
- Unitarios **118/118** (11 archivos).
- e2e M5 **36/36** (los 2 fallidos de M3 y M4 son pre-existentes, no causados por B4/B5).
- Contrato local **29/29**; diff contra el vault **0 diferencias**, **0 operaciones fuera de alcance**.
- **Smoke contra Supabase (12/12 pasos):** reserva M4 → cobro M5 → PDF → anulación → re-anulación idempotente → detalle estado ANULADO → listado filtrado por estado. Todos los pasos pasaron.

#### Problema encontrado en el smoke

1. **`import PDFDocument from 'pdfkit'` compilaba en TSC y NestJS pero fallaba en runtime** con `pdfkit_1.default is not a constructor`. El SWC compila a CJS (`require`) y el import ES default no funciona con el módulo CJS de pdfkit. Fix: `const PDFDocument = require('pdfkit')`.

#### Commits

- **fix(m5): require pdfkit instead of ES default import (CJS compatibility)** → [commit f04860d](https://github.com/GonzaloVila/FitZone-Sports/commit/f04860d)

---

## 2026-10-04 — Integración de Unidad III (Auth JWT+Roles, TOTP, Bloqueados, Sincronización Offline) en `m5-pagos`

**Fecha:** 04/10/2026 — **Rama:** `m5-pagos` — **Origen:** rama `gonza` (commit `7f4067e`)

### Merge

Se integró a `m5-pagos` la implementación de la Unidad III que venía de la rama `gonza`:
Auth JWT+Roles, TOTP/QR dinámico (RF-04), lista de bloqueados y sincronización offline (RNF-01).

- Commit del merge: `43196a0` — `merge(gonza): integra Auth JWT+Roles, TOTP, Bloqueados y Sincronización Offline`.

#### Conflictos resueltos (5 archivos)

1. **`package.json` / `package-lock.json`** — ambas ramas sumaban dependencias: M5 traía `pdfkit`, gonza traía `otplib`, `passport`, `passport-jwt`, `@nestjs/jwt`, `@nestjs/passport`. Se combinaron (todo aditivo) y se regeneró el lock con `npm install --package-lock-only`.
2. **`membresia.entity.ts`** — M5 conservaba `precio` y el comentario de `calcularVigencia`; gonza agregaba la interfaz `MembresiaNoVigente`. Se conservaron ambas partes.
3. **`membresia.repository.ts`** — imports combinados (M5: `PRECIOS_PLAN`; gonza: `MembresiaNoVigente`) más `buscarNoVigentes()` que ya venía.
4. **`usuarios.module.ts`** — el `exports` de M5 tenía `MembresiaPrecioService` y gonza sumaba `UsuariosService` (para el login). Se exportaron los tres: `[MembresiasService, SociosService, MembresiaPrecioService, UsuariosService]`.

#### Verificación

- `npm install` + `npx prisma generate` en verde.
- Unitarios **118/118** (11 archivos).
- e2e **135/135** (7 archivos) contra la base local `fitzone_test`.
- `npm run build` en verde.
- `npx tsc --noEmit`: quedan errores pre-existentes en `pago.repository.spec.ts` (acceden a `mock.calls[0]![0]` tipado `unknown`). No los introdujo el merge, no hay script de typecheck en el repo y el build (SWC) pasa.

#### Problemas encontrados

1. **El primer `prisma migrate deploy` se conectó a Supabase** (por el `.env` cargado por defecto) y no a la base local de test. Las migraciones de gonza (`20261004000000_socio_totp`, `20261004010000_membresia_updated_at`) no quedaron aplicadas en `fitzone_test`. Se corrigió apuntando `DATABASE_URL` explícito a la local y re-aplicando.
2. **`EmpleadoSede.sede_id` es `@unique`** (1 sede = 1 recepcionista). El smoke de auth fallaba al asignar el recepcionista a la sede 1 (ya ocupada); se resuelve creando una sede propia en el smoke.

#### Commits

- **merge(gonza): integra Auth JWT+Roles, TOTP, Bloqueados y Sincronización Offline** → [commit 43196a0](https://github.com/GonzaloVila/FitZone-Sports/commit/43196a0)

### Smokes contra Supabase

Con la app corriendo contra Supabase se verificaron los flujos de M5 y de la Unidad III:

#### Smoke M5 (12/12 pasos)

- Fix previo: el smoke esperaba `monto: 4250` hardcodeado, pero el sistema cobra el `precio_aplicado` real de la reserva (5100 por recargo pico). Se corrigió para comparar contra `precio_aplicado` dinámico.
- Sede → cancha → usuario → socio+membresía → reserva → cobro APROBADO → PDF → anulación ×2 → detalle ANULADO → listado.

#### Smoke Auth/TOTP/Bloqueados/Sync (9/9 pasos)

- Login de socio → JWT.
- `POST /auth/registro-qr` → URI `otpauth://` generado.
- Ingreso con **TOTP válido** → 201; con **TOTP inválido** → 403.
- Login de RECEPCION → `sede_id` en payload (desde `EmpleadoSede`).
- `GET /bloqueados` como RECEPCION → 200; como SOCIO → 403 (rol protegido).
- `POST /sincronizacion/ingresos` → lote procesado con `ok: true`.

Los smokes (`test/smoke-supabase.cjs` y `test/smoke-auth-qr.cjs`) quedan como untracked: son herramientas locales de QA, no parte del repo.

### e2e de M1–M5 contra Supabase

Además de los smokes, se corrieron los e2e existentes apuntando a la base de Supabase (`DATABASE_URL` de Supabase + `FITZONE_E2E_ALLOW_REMOTE=1`). Los e2e insertan fixtures con datos únicos y los borran en el `afterAll`, así que no ensucian la base compartida:

| Suite | Resultado |
|-------|-----------|
| M1 | 13/13 |
| M2 | 15/15 |
| M3 | 20/20 |
| M4 | 36/36 |
| M5 | 36/36 |
| errores-4xx | 29/29 |
| errores-dominio | 8/8 |
| **Total** | **157/157** |

---

## 2026-10-04 — RF-02: renovación automática + cobro interno de membresía, y el pago sobrevive a la baja del socio

**Fecha:** 04/10/2026 — **Rama:** `m5-pagos`

### RF-02 — Renovación automática y cobro interno (alta / cambio de plan)

Se implementó el cobro de membresía interno, además del flujo HTTP de M5:

- **Event bus** (`@nestjs/event-emitter`): M1 emite `socio.dadoDeAlta` (alta de socio) y `membresia.planCambiado` (cambio de plan sobre membresía no vigente); M5 escucha y cobra. Los nombres de eventos viven en `commons/eventos.ts` para que M1 no importe a M5 (el grafo sigue siendo M5 → M1, sin ciclos).
- **`RenovacionesService.cobrarMembresia()`**: cobra PRIMERO con la pasarela y solo inserta el Pago si APROBADO (a diferencia de `procesarPago`, que inserta PENDIENTE antes). Un RECHAZADO deja todo como estaba.
- **Alta de socio = consecuencia del pago**: `SociosService.crear()` cobra tras crear socio+membresía; si la pasarela rechaza, compensa (borra el socio) y el alta responde 402.
- **Cambio de plan sobre vencida/suspendida**: `MembresiasService.modificar()` cobra el plan nuevo ANTES del update; si rechaza, el plan no se modifica (402).
- **`RenovacionesCron`** (M5, medianoche): renueva las membresías con `renueva_automatica=true` y `fecha_fin` vencida. Cobra primero, renueva solo si APROBADO. Las SUSPENDIDA no renuevan (decisión del admin). Vive en M5 y no en M1 a propósito (el cobro es de M5; ver `pagos.module.ts`).

### Variante A — El pago sobrevive a la baja del socio (historial)

El alta ahora genera un `PagoMembresia`, y `DELETE /socios` borra la membresía → la FK se rompía. Decisión: el Pago es historial y no se borra.

- **Migración `20261004020000_pago_membresia_set_null`**: `PagoMembresia.membresia_id` nullable con `ON DELETE SET NULL`. Al borrar la membresía, el enlace queda en NULL y el Pago sobrevive.
- **`ConceptoPago.MEMBRESIA.membresia_id`** pasa a `number | null` en el dominio (la rama de ENTRADA de `PagoIn` sigue exigiendo el id; null solo existe en la salida).
- **Comprobante con identidad (RF-14)**: `ComprobantesService` ahora imprime **nombre y email** del socio (resuelto al cobrar vía `UsuariosService.buscarDatosParaComprobante()`). El PDF es un snapshot autosuficiente: aunque se borre el socio, el comprobante dice quién pagó.
- `socio.repository.eliminar()` vuelve a su versión original (no toca pagos); la FK SetNull desvincula el enlace solo.

### Verificación

- `npm run build` y unit **120/120** (2 nuevos del comprobante: nombre/email y "no disponible").
- e2e **136/136** en local (nuevo test en M1: el pago sobrevive a la baja con `membresia_id: null` + comprobante servido).
- e2e **136/136** contra **Supabase** (migración aplicada, `FITZONE_E2E_ALLOW_REMOTE=1`).
- Contrato: **0 diferencias** contra `/docs-json`. El OpenAPI se genera de los DTOs de entrada (que exigen `membresia_id` integer), así que el nullable de la salida es de runtime y no altera el documento.
- DBML actualizado (`PagoMembresia.membresia_id` nullable + nota del SetNull).

### Commits

- **feat(m5): RF-02 renovacion automatica y cobro interno de membresia; el pago sobrevive a la baja (historial con identidad)** → [commit 5c83f7e](https://github.com/GonzaloVila/FitZone-Sports/commit/5c83f7e)
- **test(m5): tipa el mock de findMany para que tsc pase limpio (fix de los errores pre-existentes del spec)** → [commit 6c9aa3d](https://github.com/GonzaloVila/FitZone-Sports/commit/6c9aa3d)

---

## 2026-10-07 — Unidad III: errores por módulo, mapper de errores de Prisma y repository de dominio (Fowler) para Reserva y Membresía – Santino Mazzulla (P3 - Frontend Developer) y Exequiel Ansaldi (P2 - Backend Developer)
 
**Fecha:** 07/10/2026 — **Rama:** `m5-pagos` — Santino + Exequiel
 
### Actividades
 
1. **Errores por módulo (`errors/`) — Santino y Exequiel**
   - `commons/filters/problem.exception.ts` queda solo con lo genérico: `ProblemDetails`, `ProblemException`, `TITLES`, `GENERIC_TYPE`, `recursoNoEncontrado()`, `conflictoDeDominio()` y `datosInvalidos()`. Los guards de `commons/` no se movieron (el 401/403 es genérico).
   - Archivos nuevos, con los mismos `type`/`title`/`detail`/`status` que tenían: M1 `socios.errors.ts` y `membresias.errors.ts`; M2 `ingresos.errors.ts` (incluye el 403 de sincronización sin sede); M3 `clases.errors.ts`, `esperas.errors.ts` y `reservas-clases.errors.ts` (16 `ProblemException` que estaban inline en los tres services); M4 `reserva.errors.ts` (`turnoOcupado`, `turnoOcupadoBody`, `canchaEnMantenimiento`, `reservaYaCancelada`, `rangoHorarioInvalido`) y `canchas.errors.ts`; M5 `pago.errors.ts` y `renovaciones.errors.ts`; Auth `auth.errors.ts` (credenciales, TOTP inválido, clave TOTP sin configurar).
   - Los imports de services, controllers y módulos se actualizaron. Ningún spec necesitó cambios por este paso.
2. **Mapper de errores de Prisma — Santino y Exequiel**
   - `commons/errors/prisma.mapper.ts`: `mapearErrorPrisma(error)` devuelve `'UNIQUE'` (P2002), `'NO_ENCONTRADO'` (P2025), `'FK'` (P2003), `'EXCLUSION'` (violación de una constraint de exclusión registrada) o `null`. El nombre de la constraint de RN-02 vive una sola vez en el código, como dato de un registro (`EXCLUSION_CONSTRAINTS`) dentro del mapper.
   - `problem.filter.ts` usa el mapper en la rama de la constraint de exclusión (`EXCLUSION` → `turnoOcupadoBody()`, importado desde `m4-canchas/errors/reserva.errors`). Diff mínimo en el filtro.
   - Dos capas: el mapper sube el string de la base a una causa, una sola vez; el `errors/` de cada módulo baja esa causa al vocabulario del contrato.
   - `prisma.mapper.spec.ts`: un unit por código, el caso de la constraint de exclusión y los `null`.
3. **Repository de dominio para Reserva (M4) — Santino y Exequiel**
   - `m4-canchas/domain/reserva.port.ts`: `abstract class ReservaRepository` (`crear`, `buscarPorId`, `cancelar`, `listarOcupadasEnRango`, `listar`) y los tipos `ReservaNueva`, `ResultadoCrearReserva` y `FiltrosListarReservas`.
   - `m4-canchas/repositories/reserva.repository.ts`: `PrismaReservaRepository extends ReservaRepository`. `crear()` traduce `EXCLUSION` → `{ ok: false, motivo: 'TURNO_OCUPADO' }` y `cancelar()` traduce `NO_ENCONTRADO` → `null`, ambos con el mapper.
   - `canchas.module.ts`: `{ provide: ReservaRepository, useClass: PrismaReservaRepository }`. Los services conservan `constructor(private readonly reservas: ReservaRepository)`, ahora contra el puerto.
   - Flujo de RN-02 sin cambios: la base rechaza la segunda reserva → el adaptador la mapea a `EXCLUSION` → `TURNO_OCUPADO` → el service lanza `turnoOcupado()` → 409 `turno-ocupado`.
4. **Repository de dominio para Membresía (M1) — Santino y Exequiel**
   - `m1-usuarios/domain/membresia.port.ts`: `abstract class MembresiaRepository` (`buscarPorSocioId`, `obtenerParaCobro`, `actualizar`, `marcarVencidas`, `buscarNoVigentes`, `listarRenovables`, `renovar`) y el tipo de dominio `MembresiaParaCobro`, que reemplaza al tipo-fila `MembresiaConSocioRow`.
   - `m1-usuarios/repositories/membresia.repository.ts`: `PrismaMembresiaRepository`. `obtenerParaCobro` ahora devuelve `MembresiaParaCobro` (el cruce a `Socio` y el `Decimal` → `number` pasaron al adaptador). Donde se capturaba P2025 (`actualizar`, `renovar`) se usa el mapper (`NO_ENCONTRADO` → `null`).
   - `usuarios.module.ts`: `{ provide: MembresiaRepository, useClass: PrismaMembresiaRepository }`. `MembresiasService`, `MembresiaPrecioService` y `MembresiasCron` inyectan el puerto. La firma pública de los services no cambió; `estaVigente` y `EstadoMembresia` tampoco.
5. **Mapper aplicado a los repositorios de M1, M2 y M3 — Santino y Exequiel**
   - Las capturas manuales de P2002 y P2025 pasaron a `mapearErrorPrisma`: M1 (`socio.repository`, `usuario.repository`: `NO_ENCONTRADO` → `null`), M2 (`ingreso.repository`: `UNIQUE` → `ACCESO_DUPLICADO`, `NO_ENCONTRADO` → `null`) y M3 (`espera-clase.repository`: `UNIQUE` → `ESPERA_EXISTENTE` / `RESERVA_DUPLICADA`, `NO_ENCONTRADO` → `null`; `reserva-clase.repository`: `UNIQUE` → `RESERVA_DUPLICADA`, `NO_ENCONTRADO` → `null`). 9 puntos en 5 archivos; la equivalencia es exacta (mismos códigos, mismos resultados), sin cambios de comportamiento.

### Decisiones tomadas
 
1. **El puerto con `abstract class` es una reversión acotada, solo para Reserva y Membresía.** Cierra, para esos dos repositorios, la decisión de la entrada «Migración de M1-M5 a arquitectura en capas» («no hay interfaz por repositorio ni token de inyección»). Se reintroduce porque la cátedra pidió un repositorio de dominio tipo Fowler (el equivalente al puerto JPA de Spring) para esas dos entidades. El resto de los repositorios sigue como clase concreta `@Injectable()`. Una `abstract class` sirve de contrato y de token de inyección a la vez, sin tokens string.
2. **No se renombraron los métodos a vocabulario de colección** (`agregar`, `deId`, etc.): se mantienen los nombres actuales para no tocar todos los call sites de M2, M3, M4 y M5.
3. **Dos capas para los errores de base.** El mapper (`commons/errors`) traduce la mecánica de Prisma a una causa; cada `errors/` traduce la causa al contrato. No se unificaron textos que hoy difieren (ver 4).
4. **Textos repetidos con variantes se conservan como factories distintas** para no cambiar el contrato HTTP: `clase-pasada` (3 textos), `socio-en-mora` (2), `reserva-duplicada` (2) en M3, e `idempotencia-repetida` en M5 (`pago.errors` con title «Idempotency-Key repetida» y `renovaciones.errors` con title «Idempotencia repetida»).
5. **Los 422 de «al menos un campo para modificar»** (usuarios, socios, membresías, canchas) se construyen con `datosInvalidos()` desde el `errors/` de cada módulo: la respuesta es idéntica a la del `ProblemException` inline que había.
6. **`MembresiaParaCobro`** ya existía con la misma forma en `membresia-precio.service.ts` (nadie más lo importaba). Se movió al puerto y el service dejó de mapear: devuelve lo que entrega el repositorio. La mecánica del mapeo (Decimal → number, `usuario_id` del socio) pasó a testearse en el adaptador (`membresia.repository.spec.ts`).
7. **Fuera de alcance, sin tocar:** `prisma/schema.prisma` y migraciones, Strategy (`PricingStrategyFactory`), Observer (`CupoLiberadoSubject`), el event bus, la máquina de estados de la membresía y los repositorios de M4 (cancha) y M5.

### Verificación
 
- `npx tsc --noEmit`, `npm run build` y `npx prisma validate`: en verde. Se corrieron tras cada paso.
- `npm run test:unit`: **131/131** en 13 archivos (antes 120/120 en 11): los 7 nuevos de `prisma.mapper.spec.ts` y los 4 nuevos de `membresia.repository.spec.ts`. Los specs de membresías, de precio de membresía y de precio de reserva dan el mismo resultado que antes; el único cambio de lógica es que el mock de `membresia-precio.service.spec.ts` ahora devuelve el tipo de dominio y no la fila.
- El server levanta con `node dist/main.js`: la DI resuelve los dos puertos.
- **Smoke contra Supabase (20 chequeos, todos OK):** alta de sede, cancha, usuario y socio con membresía; `GET /socios/{id}/membresias` → 200 (MENSUAL / ACTIVA, sin `precio`); socio inexistente → 404; reserva 19:00–20:00 → 201; reserva 19:30–20:30 (solape parcial) → **409 `turno-ocupado` con el mismo body de antes** (`application/problem+json`); reserva contigua 20:00–21:00 → 201; dos reservas simultáneas al mismo turno → un 201 y un 409; cancelar → 204, cancelar de nuevo → 409 `reserva-ya-cancelada`; el turno liberado vuelve a reservarse. Los datos se borraron al final, solo los creados por el smoke (sede, cancha, usuario, socio, membresía, pagos y reservas): 0 restos verificados por conteo. El smoke se corrió antes de la actividad 5: los repositorios de M1, M2 y M3 migrados al mapper se verificaron con `tsc`, `build` y los unitarios, y sus caminos de ACCESO_DUPLICADO, ESPERA_EXISTENTE y RESERVA_DUPLICADA quedan para el e2e.
- `npm run test:e2e` (esperado 141): **no se corrió**, ver pendientes.
- Comparador de contrato contra `/docs-json`: **no se corrió**, ver pendientes.

### Commits

- [commit 6a4b25f](https://github.com/GonzaloVila/FitZone-Sports/commit/6a4b25f) `refactor(u3): errores por modulo, mapper de errores de Prisma y repository de dominio para Reserva y Membresia`
- `docs: registra en el LOG los errores por modulo, el mapper de Prisma y los repositorios de dominio` (este mismo commit)

### Pendientes que siguen abiertos

1. **e2e sin correr:** este equipo no tiene Docker (`docker` no está en el PATH) ni `backend/.env.test`, así que no se pudo levantar el Postgres de `docker-compose.test.yml`. Hay que correr `npm run test:e2e` (esperado 141, incluido el test de concurrencia de RN-02) antes de integrar.
2. **Comparador de contrato sin correr:** `backend/contrato/` (gitignored) no existe en este checkout. Hay que correrlo contra `/docs-json` (esperado 0 diferencias). El refactor no toca DTOs ni decoradores de Swagger.
3. **Repositorios que siguen capturando P2002/P2025 a mano:** `cancha.repository` (M4) y `pago.repository` (M5, dos puntos). M1, M2 y M3 ya usan el mapper. Se pueden migrar cuando se toquen.
4. **`problem.filter.ts` importa de `m4-canchas/errors`** (commons → módulo de dominio), como se pidió. Si el equipo prefiere no tener esa dependencia, la alternativa es que el filtro delegue el body de `EXCLUSION` a un registro en commons.
5. **Máquina de estados de la membresía (State):** sigue fuera de alcance.

---

## 2026-10-08 — Camel case en todo el código y penalidad por cancelación tardía de clase (RF-07) — Exequiel Ansaldi (P2 - Backend Developer)

**Fecha:** 08/10/2026 · **Rama:** `m5-pagos`

> Entrada reconstruida el 18/10/2026 a partir de los mensajes y del diff de los commits. No se volvió a correr ninguna verificación: los números son los que declaran los commits.

### Actividades

1. **Refactor global de `snake_case` a `camelCase`** ([commit de06788](https://github.com/GonzaloVila/FitZone-Sports/commit/de06788), 133 archivos)
   - Identificadores de dominio, DTOs, queries, paths y claims del JWT pasan a camelCase.
   - Los query params y path params de la API y del contrato también quedan en camelCase.
   - La base de datos, Prisma y las migraciones se quedan en snake_case: los repositorios traducen fila (snake) a entidad (camel).
   - Contrato OpenAPI actualizado a camelCase y exportado al vault; comparador con 0 diferencias.

2. **RF-07: penalidad por cancelación tardía de una clase** ([commit 6418cf9](https://github.com/GonzaloVila/FitZone-Sports/commit/6418cf9))
   - Cancelar una clase con menos de 2 horas de anticipación se permite y cobra el 50% del valor nominal (5000 ARS) como un Pago con concepto nuevo `RESERVA_CLASE` (subtipo `PagoReservaClase`, migración `20261008001219_pago_reserva_clase`).
   - M3 emite el evento por el bus **antes** de cancelar, así que un 402 de la pasarela deja la reserva confirmada. M5 cobra desde un listener, con idempotencia `penalidad-clase-{id}`. `PagosModule` importa `ClasesModule` (arista M5 → M3).
   - Contrato: la respuesta de `POST /pagos` pasa a `oneOf` de 3 ramas, `GET /pagos` suma el tipo `RESERVA_CLASE` y se quita el 409 de las cancelaciones.

3. **Comprobantes de pago rediseñados**: fechas y horarios en formato `YYYY-MM-DD HH:MM` en hora local de la sede (ART), badge de estado centrado y barra de acento bajo "Detalle" que ya no tapa el texto.

4. **Máquina de estados de la membresía** (patrón State, en el mismo commit 6418cf9): `m1-usuarios/entities/membresia-estado.ts` modela ACTIVA, VENCIDA y SUSPENDIDA con las transiciones `alVencer` (cron diario), `alSuspender` y `alReactivar` (PATCH del admin) y `alRenovar` (RF-02). `MembresiasService` consulta la vigencia y decide las transiciones por ahí. Tiene su spec (`membresia-estado.spec.ts`).

5. **Specs movidos a `test/unit`**: 14 specs de `src/` pasan a `test/unit` (espejo del árbol) con el alias `src` en `vitest.unit.config.ts`.

### Decisiones tomadas

1. **camelCase solo en el código.** La base, Prisma y las migraciones siguen en snake_case para no migrar columnas; la traducción vive en los repositorios.
2. **La penalidad se cobra antes de cancelar.** Si la pasarela rechaza (402), la reserva sigue confirmada: no hay nada que revertir.
3. **Un solo cobro de penalidad por reserva:** `reserva_clase_id` es único en `PagoReservaClase`, igual que `PagoReserva` en canchas.
4. **State convive con Strategy.** State decide qué se puede hacer con la membresía; Strategy (precios de M4) decide cómo se cobra. La persistencia (enum en la base) y el contrato (`MembresiaOut.estado`) no cambian: el adaptador de Prisma guarda el `.nombre` del estado resultante.
5. **Vigencia real = fecha.** Entre la `fechaFin` y la corrida del cron el registro sigue ACTIVA; la única causa inmediata e irrevocable de no vigencia es SUSPENDIDA y el vencimiento se deriva de la fecha.
6. **Mudanza de specs a `test/unit`.** Se revirtió el 15/10 con la co-locación de los tests junto al código (ver la entrada de esa fecha).

### Verificación

Según los mensajes de los commits:
- camelCase: `tsc` 0 errores, unit 152, e2e 143.
- RF-07 y comprobantes: migración aplicada en local y en Supabase, e2e 143/143 en local y en remoto.

### Commits

- [`de06788`](https://github.com/GonzaloVila/FitZone-Sports/commit/de06788) refactor(global): snake_case a camelCase en todo el código (excepto base de datos)
- [`6418cf9`](https://github.com/GonzaloVila/FitZone-Sports/commit/6418cf9) feat(rf07/m5): penalidad por cancelación tardía de clase cobrada como Pago RESERVA_CLASE; comprobantes con hora local y rediseño; specs a test/unit

---

## 2026-10-09 — Suite de tests: flujos faltantes, concurrencia y cobertura — Exequiel Ansaldi (P2 - Backend Developer)

**Fecha:** 09/10/2026 · **Rama:** `m5-pagos`

> Entrada reconstruida el 18/10/2026 a partir de los mensajes y del diff de los commits. No se volvió a correr ninguna verificación: los números son los que declaran los commits.

### Actividades

1. **Suite e2e nueva de auth** (`auth.e2e-spec.ts`, [commit 2e49d7a](https://github.com/GonzaloVila/FitZone-Sports/commit/2e49d7a)): login (200 y 401), registro de QR, ingreso con TOTP válido e inválido, `GET /bloqueados` (200, 401 y 403) y `POST /sincronizacion/ingresos` (lote, bloqueado y duplicado).

2. **Flujos faltantes por módulo** (mismo commit):
   - M1: cambio de plan sobre una membresía no vigente (cobro por evento).
   - M2: RF-03 acceso multisede y RF-04 socio sin QR (compatibilidad hacia atrás).
   - M5: RF-02 renovación automática (el cron cobra y extiende; no renueva sin el flag ni si está suspendida).
   - M4 y unit de precios: el recargo de hora pico se decide por el **inicio** de la reserva, no por el solape, y el socio con 15% de descuento sobre el precio estándar. Se ajusta `PeakHourPricing` en consecuencia.

3. **Más cobertura** ([commit 76d7983](https://github.com/GonzaloVila/FitZone-Sports/commit/76d7983)):
   - Auth: sincronización con egresos del mismo lote (`ingresoLocalId`) e ingreso ausente (`INGRESO_NO_ENCONTRADO`); `GET /bloqueados` incremental (`?actualizadoDesde=`) y con rol GERENTE.
   - M3: se espía el observer de email (canal de notificación) al liberar un cupo (RF-08).
   - M4: concurrencia real de RN-02, con dos reservas del mismo turno en paralelo (una responde 201 y la otra 409).

4. **Herramientas de test** (commits 2e49d7a y [07fdb3d](https://github.com/GonzaloVila/FitZone-Sports/commit/07fdb3d)): reporters verbose en vitest (imprime cada test), cobertura v8 (`test:e2e:cov`) y `.gitignore` para `coverage-e2e/` y `.vitest/`.

### Decisiones tomadas

1. **El recargo pico seguía la regla "por inicio"** en esta fecha; se cambió el 12/10 (la reserva que cubre toda la franja también paga el recargo) y el 14/10 pasó a reglas del pipeline de precios (RF-11).
2. **La concurrencia de RN-02 se prueba contra la base real**, no con mocks: el solape lo resuelve la constraint de la base.

### Verificación

Según los mensajes de los commits:
- Primer commit: `tsc` 0 errores, unit 153, e2e 158.
- Segundo commit: `tsc` 0 errores, unit 153, e2e 162.

### Commits

- [`07fdb3d`](https://github.com/GonzaloVila/FitZone-Sports/commit/07fdb3d) chore: ignora `.vitest/` (output temporal de vitest)
- [`2e49d7a`](https://github.com/GonzaloVila/FitZone-Sports/commit/2e49d7a) test: cubre flujos faltantes (auth/TOTP/bloqueados/sync, RF-02, RF-03, RF-04, RF-11) + cobertura y verbose
- [`76d7983`](https://github.com/GonzaloVila/FitZone-Sports/commit/76d7983) test: cubre egresos offline, concurrencia RN-02 y bloqueados incremental/GERENTE

---

## 2026-10-12 — Unidad IV (CQRS): reporte de pagos por período en PDF — Gonzalo Vila + Santiago Rayn

**Fecha:** 12/10/2026 — **Rama:** `m5-pagos`

### Actividades

1. **Consolidado de ingresos en M5 (read side)**
   - `ReporteIngresosService.consolidadoPagos({ desde, hasta })`: toma los pagos **APROBADO** del rango `[desde, hasta)` y los agrupa por **día local de la sede** (`aFechaLocal`, exportada desde `commons/fechas.ts`), **sede** y **tipo de concepto**, con monto por fila y total general. Los importes se suman en centavos para evitar ruido de coma flotante.
   - `PagoRepository.listarAprobadosConSede()`: resuelve la sede según el concepto con includes anidados (RESERVA_CANCHA: reserva → cancha → sede; MEMBRESIA: membresía → socio → sede de origen; RESERVA_CLASE: reserva de clase → clase → sede). Si un eslabón falta, la fila es **huérfana**: se descarta y se cuenta aparte, sin romper el reporte.
   - `ReporteIngresosService` se exporta desde `PagosModule`.
   - [commit 127550a](https://github.com/GonzaloVila/FitZone-Sports/commit/127550a)

2. **Módulo `reportes` y `GET /reportes/pagos`**
   - `ReportesModule` (importa `PagosModule` y `CommonsModule`), registrado en `AppModule`. Grafo: **reportes → M5**, M5 no importa reportes (sin ciclos).
   - `ReportesController`: `JwtAuthGuard` + `RolesGuard` + `@Roles('GERENTE')`; `desde`/`hasta` se traducen con `rangoDelDia()` (`hasta` es un día inclusivo) y la respuesta es un `StreamableFile` `application/pdf` con `Content-Disposition`. `ListarReporteQueryDto` valida `YYYY-MM-DD` + `IsISO8601 strict` (fecha inválida → 422).
   - `ReportesService.armarPdf()` (pdfkit, A4, `compress: false`) con la paleta del comprobante: banda de marca, período (o «histórico»), tabla con filas alternadas, **total general** y pie. Pagina si hay muchas filas. No se persiste en disco: devuelve el Buffer.
   - [commit 1b14afc](https://github.com/GonzaloVila/FitZone-Sports/commit/1b14afc)

### Decisiones tomadas

1. **Agregación en TypeScript con includes anidados**, no SQL a mano: para el alcance académico es la opción simple y testeable con mocks (con volumen real convendría un `GROUP BY`).
2. **Dos services con responsabilidades separadas:** `ReporteIngresosService` (M5) calcula los datos; `ReportesService` solo los dibuja. El mismo consolidado sirve para otros formatos (CSV/JSON) sin tocar M5.
3. **`FilaReporte` lleva además `sedeNombre`** (el PDF muestra el nombre de la sede) y **`ReporteIngresos` lleva `huerfanos`** (el pie del PDF avisa si hubo pagos descartados). Ambos agregados respecto de la especificación.
4. **`armarPdf` es síncrono:** se lee el buffer interno de pdfkit después de `end()`, sin listener `data` (con listener, los trozos llegan en el siguiente tick).

### Verificación

- `npx tsc --noEmit`: limpio.
- `npm run test:unit`: **167/167** (nuevos: consolidado, repositorio del reporte y PDF — `%PDF-`, período, filas, total general, vacío, paginación y «histórico»).
- PDF de ejemplo generado con `armarPdf` y revisado visualmente.
- **e2e (`test/reportes.e2e-spec.ts`) escrito pero NO corrido**, ver pendientes.

### Commits

- **feat(m5): reporte de ingresos consolidado (APROBADO por dia local, sede y concepto)** → [commit 127550a](https://github.com/GonzaloVila/FitZone-Sports/commit/127550a)
- **feat(reportes): GET /reportes/pagos en PDF (solo GERENTE)** → [commit 1b14afc](https://github.com/GonzaloVila/FitZone-Sports/commit/1b14afc)
- `docs: registra en el LOG el reporte de pagos por periodo (Unidad IV)` (este mismo commit)

### Pendientes que siguen abiertos

1. **e2e sin correr:** este equipo no tiene el Postgres local levantado (Docker Desktop apagado). Hay que correr `npm run test:e2e` (incluye `reportes.e2e-spec.ts`: 200 PDF para GERENTE, 403 SOCIO/RECEPCION, 401, 422), en local y contra Supabase.
2. **Contrato OpenAPI sin exportar ni comparar:** `backend/contrato/` (gitignored) no existe en este checkout. Hay que exportar al vault la operación `GET /reportes/pagos` (tag `reportes`) y correr el comparador (esperado 0 diferencias).
3. **Flujo real vía API** con una reserva cobrada (generar el PDF desde el endpoint y abrirlo) pendiente hasta tener la base disponible.

---

## 2026-10-12 — Rechazos de cobros internos, recargo pico, aviso de cupo liberado y contrato 402 — Exequiel Ansaldi (P2 - Backend Developer)

**Fecha:** 12/10/2026 · **Rama:** `m5-pagos`

> Entrada reconstruida el 18/10/2026 a partir de los mensajes y del diff de los commits. No se volvió a correr ninguna verificación.

### Actividades

1. **Los rechazos de los cobros internos ahora se propagan** ([commit d9b5f9c](https://github.com/GonzaloVila/FitZone-Sports/commit/d9b5f9c))
   - Problema: los listeners internos usaban el valor por defecto `suppressErrors=true` de `@nestjs/event-emitter`, que se tragaba el 402 del cobro. El alta, el cambio de plan, la penalidad de clase y la renovación no revertían cuando la pasarela rechazaba.
   - Arreglo: se pasa `suppressErrors: false` en esos listeners para que el rechazo propague y haga rollback.
   - Mock de pasarela configurable: la variable `PASARELA_MOCK` fuerza el resultado de `cobrar()` por llamada (APROBADO, RECHAZADO o PENDIENTE) para ejercitar los caminos internos. Sin la variable, la lógica por token queda igual.
   - Tests: e2e de alta y cambio de plan rechazados y PENDIENTE, penalidad rechazada, y unit del override.

2. **El recargo de hora pico también aplica si la reserva cubre toda la franja** ([commit 19689a4](https://github.com/GonzaloVila/FitZone-Sports/commit/19689a4))
   - Antes el plus solo se cobraba si la reserva empezaba dentro de [19:00, 21:00). Ahora también cuando cubre la franja entera (arranca a las 19:00 o antes y termina a las 21:00 o después), porque la abarca completa.
   - Se agregan casos unit y un caso al e2e de RF-11.

3. **Aviso de cupo liberado con la marca de FitZone** ([commit 75b4088](https://github.com/GonzaloVila/FitZone-Sports/commit/75b4088))
   - El asunto y el cuerpo salen de una plantilla con texto y HTML (con texto de respaldo para clientes sin HTML).
   - El horario se muestra legible en hora de la sede (es-AR, `ZONA_SEDE`) y el aviso lleva el nombre de la clase: se agrega `nombreClase` al evento `CupoLiberado` y el emisor lo completa con `clase.tipo`. Se quita el "first-come" del texto.
   - `.env.example` documenta `MAIL_FROM` con nombre de marca y la App Password de Gmail.
   - Tests: unit de la plantilla y una aserción e2e de que el evento lleva `nombreClase`.

4. **El contrato declara el 402 de los cobros internos** ([commit 7a9f9b0](https://github.com/GonzaloVila/FitZone-Sports/commit/7a9f9b0))
   - `POST /socios`, `PATCH /socios/{socioId}/membresias` y `POST /reservas-clases/{reservaClaseId}/cancelaciones` pueden responder 402 cuando la pasarela rechaza el cobro interno (RF-02 y RF-07). Se agrega `@ApiPaymentRequiredResponse` para que el contrato publicado (`/docs-json`) lo declare; antes prometía operaciones que nunca podían fallar así.
   - Se actualiza la copia canónica local y se exporta al vault. Comparador: 51 operaciones, 0 diferencias.

### Decisiones tomadas

1. **El rechazo de la pasarela revierte la operación que disparó el cobro** (alta, cambio de plan, penalidad, renovación). Para eso el bus no puede tragarse el error en esos listeners.
2. **La pasarela de mock se controla por variable de entorno**, no por código de test: así los e2e ejercitan RECHAZADO y PENDIENTE sin cambiar la lógica de producción.
3. **El contrato debe declarar lo que el código puede responder**: el 402 de los tres endpoints pasa a estar documentado.

### Verificación

Los mensajes de los commits no informan totales de tests. Se agregaron e2e (alta y plan rechazados y PENDIENTE, penalidad rechazada, recargo pico, evento con `nombreClase`) y unit (override de la pasarela, plantilla del aviso, recargo pico). Comparador del contrato: 51 operaciones, 0 diferencias.

### Commits

- [`d9b5f9c`](https://github.com/GonzaloVila/FitZone-Sports/commit/d9b5f9c) fix(m5): propaga rechazos de cobros internos y agrega mock de pasarela configurable
- [`19689a4`](https://github.com/GonzaloVila/FitZone-Sports/commit/19689a4) feat(m4): el recargo de hora pico aplica también cuando la reserva cubre toda la franja
- [`75b4088`](https://github.com/GonzaloVila/FitZone-Sports/commit/75b4088) feat(m3): aviso de cupo liberado con branding HTML, nombre de clase y horario legible
- [`7a9f9b0`](https://github.com/GonzaloVila/FitZone-Sports/commit/7a9f9b0) docs(contrato): declara 402 en los cobros internos (alta, cambio de plan y penalidad)

---

## 2026-10-13 — Unidad III (Patrones de diseño): Chain en validaciones de reserva

**Fecha:** 13/10/2026 · **Rama:** `m5-pagos`

### Actividades

1. **Chain of Responsibility en las validaciones previas a la reserva (M3 + M4)**
   - `m3-clases/validaciones/`: interfaz `ValidacionDeReserva` + `ContextoReserva` (contexto ya leído por el service) y los eslabones `ClaseExiste`, `SocioAlDia`, `ReservaAnticipada`, `ClaseNoComenzada`; `ValidadorDeReservas` recorre la cadena. Refactor de `reservas-clases.service.ts:crearReservaClase()`.
   - `m4-canchas/validaciones/`: `CanchaExiste`, `CanchaOperativa`, `RangoHorarioValido` + `ValidadorDeReservasCancha`; refactor de `reservas-canchas.service.ts:crear()`.
   - El orden lo arma el contenedor con un token de colección (`useFactory` en cada módulo). El solape RN-02 sigue en la constraint de la base, no en la cadena.
   - Comportamiento preservado: un error por vez, con los mismos códigos (404/403/409/422).
   - [commit a2438e5](https://github.com/GonzaloVila/FitZone-Sports/commit/a2438e5)

2. **Test de dominio con repositorio en memoria (sin Prisma)**
   - `test/unit/modules/m4-canchas/domain/reservas-canchas-en-memoria.spec.ts`: un `ReservaRepository` en memoria que modela la exclusión RN-02; corre el caso de uso `ReservasCanchasService.crear` sin base ni contenedor (crea y cotiza, RN-02 → 409, cancelar libera el turno).

### Planilla de olores (Unidad III)

| # | Archivo · línea | Olor | Evidencia | Decisión |
|---|---|---|---|---|
| 1 | `m3-clases/services/reservas-clases.service.ts` (`crearReservaClase`) y `m4-canchas/services/reservas-canchas.service.ts` (`crear`) | Condicionales encadenados / validaciones inline | 5 `if` seguidos en M3; 3 en M4 | **Corregido** — Chain of Responsibility (esta unidad) |
| 2 | `commons/filters/problem.filter.ts:188-230` | Sentencia switch / condicional sobre el mismo campo | Ramas `if (code === 'P2002'/'P2025'/'P2003')` | **No** — es la frontera única de traducción Prisma→Problem; los códigos P2xxx son finitos y estables, polimorfismo sería ceremonia |
| 3 | `m5-pagos/services/comprobantes.service.ts` | Clase grande / métodos de layout | `armarPdf`, `cabeza`, `detalle`, `pie`, `linea`, `fechaLegible`, `pesos` | **No** — el layout de un PDF es cohesivo; extraer clases daría piezas sin otro uso |
| 4 | `*/repositories/*.repository.ts` (uno por entidad) | Posible repositorio vacío / abstracción especulativa | ¿delegan 1-a-1? | **No** — traducen fila→entidad (Data Mapper), no son pass-through; ver ADR-07 y ADR-10 |
| 5 | DTOs de `m1-usuarios` (email `ana.gomez@fitzone.com.ar`, `fotoUrl`) | Código duplicado (datos de documentación) | el mismo `example` en varios DTOs | **No** — es documentación de Swagger; extraer constantes acoplaría DTOs entre sí |
| 6 | cada service tiene su `aOut` / `plainToInstance` | Código duplicado con variaciones | método homónimo por service | **No** — cada uno mapea su entidad; unificar crearía un mapper genérico acoplado a todas |

### Verificación

- `npx tsc --noEmit`: limpio.
- `npm run test:unit`: **194/194** (nuevos: validaciones de M3 y M4 y el caso de uso con repositorio en memoria).
- `npm run test:e2e`: **172/172**, M3/M4 sin cambios de comportamiento.

---

## 2026-10-14 - Unidad III: precio dinamico como pipeline de reglas (RF-11)

**Fecha:** 14/10/2026 · **Rama:** `m5-pagos`

### Actividades

1. **Refactor del precio dinamico al codigo de la catedra (RF-11, ADR-06)**
   - Se reemplazo `PricingStrategy` + `PricingStrategyFactory` (con `new` interno, sin token y con nombre de patron creacional) por la forma que da la catedra (Unidad III Clase 1 §6.2): interfaz `ReglaDePrecio { aplica(ctx); aplicar(precio, ctx) }`, una clase por regla y un `TarifadorDePrecios` que recibe la lista por DI y hace `filter(aplica).reduce(aplicar, costoBase)`.
   - `pricing/`: `contexto-de-precio.ts` (`ContextoDePrecio`), `regla-de-precio.ts` (`ReglaDePrecio` + token `REGLAS_DE_PRECIO`), `descuento-socio.regla.ts` (`DescuentoSocio`, RN-03), `recargo-horario-pico.regla.ts` (`RecargoHorarioPico`), `tarifador-de-precios.ts`, `constantes-de-precio.ts`.
   - Se elimino la regla `StandardPricing` (no-op): el precio base es la semilla del `reduce`.
   - `canchas.module.ts`: las reglas son providers y el `useFactory` arma la coleccion ORDENADA (el `@Order` de Spring); `TarifadorDePrecios` la consume. `ReservasCanchasService` inyecta `TarifadorDePrecios` y no conoce ninguna regla concreta.
   - Se borro la clase `...Factory`: elimina la lectura creacional (es Strategy con intencion de Decorator, no Factory).
   - Comportamiento identico: mismas reglas, mismo orden, mismos importes.

### Verificacion

- `npx tsc --noEmit`: limpio.
- `npm run test:unit`: **201/201** (nuevos: `reglas-de-precio.spec.ts` con `aplica` + `aplicar` por regla, y `tarifador-de-precios.spec.ts`).
- Diagramas regenerados: `pricing-pipeline` (dataflow) y `uml-strategy-classes` (clases).

### Commits

- `refactor(m4): precio dinamico como pipeline de reglas (ReglaDePrecio + TarifadorDePrecios)` (pendiente de commit).

---

## 2026-10-14 - Unidad III: cupo liberado como Observer por el bus (RF-08)

**Fecha:** 14/10/2026 · **Rama:** `m5-pagos`

### Actividades

1. **RF-08 pasa del Subject a mano al bus (codigo de la catedra, Unidad III Clase 1 §6.4)**
   - Se elimino `CupoLiberadoSubject` + la interfaz `CupoLiberadoObserver` + el registro manual en `ClasesModule.onModuleInit`. El ejemplo de Observer de la catedra es el event publisher (`publishEvent` / `@EventListener`); en Nest es `@nestjs/event-emitter` + `@OnEvent`.
   - `commons/eventos.ts`: nuevo `EVENTO_CUPO_LIBERADO = 'reservaClase.cupoLiberado'` (nombrado en pasado).
   - Los dos observers pasan a `@OnEvent(EVENTO_CUPO_LIBERADO)`: `NotificarSociosEsperaObserver` (estado) y `EmailCupoLiberadoObserver` (email). `cancelarReservaClase()` hace `await eventos.emitAsync(EVENTO_CUPO_LIBERADO, evento)`.
   - Las 3 decisiones del §6.5: (1) se emite despues de `marcarCancelada` (efecto externo -> post-commit); (2) sincrono con `emitAsync` (el request espera los mails); (3) cada oyente aisla y loguea su error (un mail que falla NO rompe la cancelacion). La penalidad RF-07 sigue aparte: `emitAsync` ANTES del update y `suppressErrors: false` para que el 402 revierta.
   - El bus es el **Observer** del proyecto: RF-08 (1 hecho -> N oyentes). El cobro interno (RF-02/RF-07) aprovecha el mismo bus para que M1/M3 publiquen sin importar a M5 (evita el ciclo M1->M5); no es un patron aparte, es un uso minimo del bus.

### Verificacion

- `npx tsc --noEmit`: limpio.
- `npm run test:unit`: **201/201**.
- `npm run test:e2e`: **172/172** (incluye el RF-08 con el spy sobre `notificarCupoDisponible`).
- Diagramas regenerados: `observer-cupo` (sequence) y `uml-observer-classes`.

### Commits

- `refactor(m3): cupo liberado por el bus (@OnEvent) en vez del Subject a mano (RF-08)` (pendiente de commit).

---

## 2026-10-15 - Unidad III: State en la reserva de cancha (CUMPLIDA derivada, RF-10)

**Fecha:** 15/10/2026 · **Rama:** `m5-pagos`

### Actividades

1. **Bug cerrado + State en la reserva de cancha (RF-10).**
   - Bug: `ReservasCanchasService.cancelar()` no miraba la fecha -> se podia cancelar una reserva cuyo turno ya habia pasado.
   - Se agrego `m4-canchas/domain/reserva-estado.ts` (patron State): `EstadoDeReserva { nombre; puedeCancelar }` + `estadoDeReserva(r)`. `CUMPLIDA` se **DERIVA** de la fecha (no se persiste; sin migracion ni cron): `ahora >= fechaHoraFin`. `puedeCancelar` = `CONFIRMADA && ahora < fechaHoraInicio` (no se cancela lo que ya empezo).
   - `cancelar()`: rechaza con 409 `reserva-pasada` (nuevo en `errors/reserva.errors.ts`) si el turno ya empezo.
   - `aOut()` expone el estado efectivo -> la API muestra `CUMPLIDA` aunque la columna siga `CONFIRMADA`.
   - `listar()` traduce el filtro: default/CONFIRMADA = activas (fin futuro); CUMPLIDA = fin pasado; CANCELADA. `ReservaRepository.listar` suma `finDesde`/`finHasta` (sobre `fecha_hora_fin`).
   - Contrato: `EstadoReserva` + `CUMPLIDA`; respuesta 409 `ConflictoCancelacionReserva` (dos causas); exportado al vault.
   - Alcance: solo cancha (M4). La clase (M3) queda igual.

### Verificacion

- `npx tsc --noEmit`: limpio.
- `npm run test:unit`: **205/205** (nuevo `reserva-estado.spec.ts`).
- `npm run test:e2e`: **175/175** (nuevos: reserva pasada -> CUMPLIDA derivada, cancelar -> 409 reserva-pasada, filtro ?estado=CUMPLIDA).

### Commits

- `feat(m4): State en la reserva de cancha con CUMPLIDA derivada (RF-10)` (pendiente de commit).

---

## 2026-10-15 - Unidad III: rango horario en Clase y State en la reserva de clase (RF-06/RF-07)

**Fecha:** 15/10/2026 · **Rama:** `m5-pagos`

### Actividades

1. **Rango horario en la clase (RF-06).**
   - `Clase.horario` (String, solo inicio) -> `horario_inicio` + `horario_fin` (timestamptz(3), como Reserva). Migracion raw con backfill (`inicio = horario`, `fin = horario + 1 h`).
   - Entidad/DTOs (`ClaseIn`/`ClaseOut`) + repo + service (valida `horarioFin > horarioInicio` -> 422 `rango-horario-invalido`). Consumidores (validadores M3, evento cupo liberado, precio M3->M5, comprobante) actualizados. Contrato (canonico + vault).

2. **State derivado en la reserva de clase (RF-07).**
   - `m3-clases/domain/reserva-clase-estado.ts`: `estadoDeReservaClase` deriva `CUMPLIDA` de `horario_fin` (no persistida). `puedeCancelar` = CONFIRMADA con `ahora < horario_inicio`.
   - `cancelarReservaClase`: bloquea cancelar una clase ya empezada -> 409 `reserva-clase-pasada`.
   - `ReservaClaseOut.estado` expone `CUMPLIDA` (el repo hace join con la clase). Contrato: `EstadoReservaClase` +CUMPLIDA, 409 `ReservaClasePasada`.

### Verificacion

- `npx tsc --noEmit`: limpio. `npm run build`: OK.
- `npm run test:unit`: **209/209** (nuevo `reserva-clase-estado.spec.ts`).
- `npm run test:e2e`: **176/176** (nuevo: reserva de clase pasada -> CUMPLIDA + cancelar -> 409).
- Comparador de contrato: **0 diferencias**.

### Commits

- `feat(m3): rango horario en Clase (horario_inicio/fin) y State en la reserva de clase` (pendiente de commit).

---

## 2026-10-15 - Suite de tests: co-locacion junto al source y piramide (unit / integracion / e2e)

**Fecha:** 15/10/2026 · **Rama:** `m5-pagos`

### Actividades

1. **Los specs se co-locan con el source.**
   - `test/` queda **solo** para E2E (`test/e2e/**/*.e2e-spec.ts`) y los helpers compartidos. Los unitarios pasan a `src/**/*.spec.ts` y los de integracion a `src/**/*.integration-spec.ts`, al lado del archivo que prueban (32 unit + 7 de integracion, movidos con `git mv`). `test/unit/` deja de existir.
   - Los specs ya usaban el alias `src/...`; se agrego `@test/*` para los helpers. `tsconfig.json` suma `paths` (`src/*`, `@test/*`, relativos) para que `tsc --noEmit` resuelva los specs co-locados, y `declaration` se movio a `tsconfig.build.json`. Cada suite tiene su config (`vitest.unit.config.ts`, `vitest.integration.config.ts`, `vitest.e2e.config.ts`).
   - Helpers en `test/helpers/`: `base-de-datos.ts` (ex `e2e.ts`), `modulo-de-integracion.ts`, `validar-dto.ts`, `pagos.fixtures.ts`.

2. **Capa de integracion (nueva).** `vitest.integration.config.ts` + `npm run test:integration`. El helper `crearModuloDeIntegracion` bootea el **modulo de feature** (no el `AppModule`) con `Config`/`Database`/`EventEmitter` —con `validate: validateEnv`, que aporta los defaults de JWT— y los specs llaman al **service directo** contra la BD real, sin HTTP. Cubren M1 (socios, membresias), M2 (ingresos, sedes), M3 (clases, reservas, esperas —partido en 3), M4 (canchas, reservas RN-02/pricing/State) y M5 (pagos). **53 tests en 10 archivos.**

3. **Specs de DTO.** Validacion de los DTOs de entrada con `class-validator.validate()` (helper `validar-dto.ts`): canchas/reservas (M4), clases/reservas/espera (M3) y usuarios/socios/membresias (M1). Es el 422 por input que antes vivia en e2e.

4. **Recorte de E2E.** De **177 a 59**: se saca lo que ahora cubre la integracion (CRUD, listados, pricing, State derivado, validacion de input) y queda lo HTTP/contrato (201+Location, 204, problem+json, cabecera `Idempotency-Key`), los cruces entre modulos (RF-02/RF-07/RF-08 por el bus), la concurrencia por HTTP y auth/errores/reportes. El test cross-modulo del cambio de plan en mora (RF-02) se pliega en `cobro-interno.e2e-spec.ts`.

### Decisiones tomadas

1. **`test/` es solo para E2E** (convencion del CLI de NestJS). Unit e integracion viven junto al source: encontrar/refactorizar el test de un archivo es 1 click, el editor mueve el test junto al renombrar, y el `git blame` queda con contexto. La unica excepcion son los helpers compartidos, que van a `test/helpers/`.
2. **Los nombres distinguen la suite:** `.spec.ts` (unit), `.integration-spec.ts` (integracion), `.e2e-spec.ts` (e2e). Clave: `*.integration-spec.ts` **no** matchea el glob `*.spec.ts`, asi que cada config filtra su capa sin pisarse.
3. **La integracion llama al service directo, no por HTTP.** El objetivo es la capa de negocio contra la BD real (repositorios + constraints); el transporte ya lo cubre el e2e.
4. **El recorte saca solo lo duplicado.** auth/errores/reportes (sin equivalente en integracion) se conservan casi enteros.

### Verificacion

- `npx tsc --noEmit`: limpio. Ahora **tambien chequea los specs co-locados** (antes `test/` quedaba fuera del `include`): destapo un `Clase` sin `horarioFin` en un spec, corregido.
- `npm run build`: OK (`dist/main.js`).
- `npm run test:unit`: **240/240** (32 archivos).
- `npm run test:integration`: **53/53** (10 archivos).
- `npm run test:e2e`: **59/59** (19 archivos).
- Piramide final: **240 / 53 / 59** (~68% / 15% / 17%).

### Commits

- `test: co-locar specs junto al source y rebalancear la piramide` (este mismo commit).
- `fix(tsconfig): paths relativos sin baseUrl (TS5090 del editor)` (este mismo commit).

---

## 2026-10-16 — Migración clase_horario_rango aplicada en Supabase
- Aplicada `20261015120000_clase_horario_rango` con `prisma migrate deploy` en la base compartida.
- Backfill verificado: las 4 filas de Clase quedaron con horario_fin = horario_inicio + 1 h.
- `migrate status`: base al día. Pendientes 1–2 de la entrada del 07/10 cerradas (e2e corrido, comparador sin diferencias).

---

## 2026-10-17 - Contrato OpenAPI: envoltorio { items, total } en listados y limpieza de contrato

**Fecha:** 17/10/2026 · **Rama:** `main`

### Actividades

1. **Alineación del Contrato OpenAPI (Puntos 5 y 6 del TL):**
   - En `TFI FitZone - OpenAPI.yaml` (vault), se crearon los esquemas envoltorios: `ListaUsuarios`, `ListaSocios`, `ListaSedes`, `ListaIngresos`, `ListaCanchas`, `ListaDisponibilidad`, `ListaClases`, `ListaReservasClase`, `ListaReservasCancha`, `ListaEsperas` y `ListaPagos`.
   - Se actualizaron las 13 operaciones GET de listado (`listarUsuarios`, `listarSocios`, `listarSedes`, `listarIngresos`, `listarCanchas`, `consultarDisponibilidad`, `listarClases`, `listarReservasDeClase`, `listarReservasCancha`, `listarReservasClase`, `listarEsperaDeClase`, `listarEsperasClase` y `listarPagos`) para responder con el schema `$ref: '#/components/schemas/ListaXxx'` conteniendo `{ items, total }`.
   - Se eliminó la respuesta huérfana `VentanaCancelacionCerrada` en `components.responses`.
   - Corrección de erratas de redacción en las descripciones del contrato (`occupants` -> `ocupantes` en `listarIngresos`). La segunda errata que figuraba acá (`(Gerente Central, A4)` -> `A3` en `listarSedes`) se revirtió: el Gerente Central es A4.

2. **Implementación de DTOs y lógica backend (NestJS):**
   - Se incorporó la interfaz genérica `PaginatedResult<T>` en `src/commons/paginacion.ts`.
   - Se crearon los 11 DTOs de Swagger con decoradores `@ApiProperty`:
     - `ListaUsuariosDto`, `ListaSociosDto` (M1)
     - `ListaSedesDto`, `ListaIngresosDto` (M2)
     - `ListaClasesDto`, `ListaReservasClaseDto`, `ListaEsperasDto` (M3)
     - `ListaCanchasDto`, `ListaDisponibilidadDto`, `ListaReservasCanchaDto` (M4)
     - `ListaPagosDto` (M5)
   - Se actualizaron los repositorios de Prisma para ejecutar conteos de registros (`prisma.<entidad>.count({ where })`) y retornar `{ items, total }`.
   - Se ajustaron los services y controllers de los 5 módulos (M1, M2, M3, M4, M5) decorando las respuestas con `@ApiOkResponse({ type: ListaXxxDto })`.

3. **Ajuste de suites de pruebas:**
   - E2E: actualizadas las aserciones en `test/e2e/m1-usuarios/usuarios.e2e-spec.ts`, `test/e2e/m2-gimnasio/sedes-ingresos.e2e-spec.ts`, `test/e2e/m3-clases/clases.e2e-spec.ts`, `test/e2e/m3-clases/listados.e2e-spec.ts` y `test/e2e/m4-canchas/disponibilidad.e2e-spec.ts` para verificar `res.body.items` y `res.body.total`.
   - Integración: adaptados los specs en M1, M2, M3, M4 y M5 (`socios`, `sedes`, `esperas-clases`, `reservas-clases`, `canchas`, `reservas-canchas`, `pagos`) para validar el objeto paginado devuelto por los servicios.

### Verificación

- `npx tsc --noEmit`: limpio.
- `npm run build`: OK.
- `npm run test:unit`: **244/244** pasaron (33 archivos).
- `npm run test:integration`: **53/53** pasaron (10 archivos).
- `npm run test:e2e`: **59/59** pasaron (19 archivos).

### Commits

- `feat(api): envoltorio { items, total } en listados y alineacion de contrato OpenAPI`

---

## 2026-10-17 - Contrato OpenAPI: cierre de docs/openapi.yaml contra el codigo

**Fecha:** 17/10/2026 · **Rama:** `main`

### Actividades

1. **`$ref` rotos en los esquemas de listado (`docs/openapi.yaml`).**
   - Eran **24** con una barra invertida delante (`$ref: \'#/components/schemas/...'`), no solo los de los listados: 13 en las respuestas 200 de las operaciones de listado (`ListaUsuarios`, `ListaSocios`, `ListaSedes`, `ListaIngresos`, `ListaCanchas`, `ListaDisponibilidad`, `ListaClases`, `ListaReservasClase` x2, `ListaReservasCancha`, `ListaEsperas` x2, `ListaPagos`) y 11 en los `items` de cada `ListaXxx` dentro de `components.schemas` (`UsuarioOut`, `SocioOut`, `SedeOut`, `IngresoOut`, `CanchaOut`, `DisponibilidadEntrada`, `ClaseOut`, `ReservaClaseOut`, `ReservaCanchaOut`, `EsperaOut`, `PagoOut`). Corregidos los 24; quedan 0.
   - Con js-yaml se recorrieron todos los `$ref` del archivo: **279, 0 sin resolver**.

2. **Esquema de seguridad.** `components.securitySchemes.bearer` (`http` / `bearer` / `JWT`), antes de `parameters`. Es lo que genera `.addBearerAuth()` con el nombre por defecto. Las 6 operaciones con `security: - bearer: []` ya tienen contra que resolver.

3. **Tags.** En el YAML se agregan `ingresos` y `esperas-clases` despues de `bloqueados`. En `backend/src/main.ts` se agrega `.addTag('reportes')` (despues de `pagos`), que el YAML ya declaraba.

4. **Rol en `listarSedes`.** «(Gerente Central, A3)» pasa a «(Gerente Central, A4)»; A3 es Recepcionista / Admin. de Sede (`empleado-sede.repository.ts` lo dice: «RECEPCION, A3»). Era la unica aparicion en el YAML.

### Decisiones tomadas

1. **El comparador de `backend/contrato/` no esta en este checkout** (esta en `.gitignore` y no existe en el disco; ver entradas del 07/10 y 12/10). No se restauro desde el historial (5091bb9 / f3e3ee7). Se lo reemplazo por (a) lint del YAML con `@redocly/cli` via `npx` y validacion de `$ref`, y (b) un script descartable que baja `/docs-json` y lo compara contra `docs/openapi.yaml`. **Ese script no quedo en el repo** (vive en el directorio temporal de la sesion).
2. **El chequeo (b) cubre menos que el comparador historico:** conjunto de (metodo, path sin el prefijo `/api/v1`, `operationId`), tags por operacion, lista de tags declarados y `security` por operacion. **No compara schemas, parametros, respuestas ni `required`.** Un «0 diferencias» de esta entrada no equivale al «0 diferencias» de las entradas anteriores.
3. **El orden de la lista de tags no se alinea:** el codigo declara `auth, usuarios, socios, membresias, bloqueados, sedes, ingresos, clases, reservas-clases, esperas-clases, canchas, reservas-canchas, pagos, reportes` y el YAML otro orden. El conjunto coincide; el orden solo cambia la presentacion en Swagger UI y no se toco.
4. **`/auth/refresh` y `/auth/logout` no se agregan al YAML** hasta que se implementen.
5. **Fuera de alcance, sin tocar:** `prisma/schema.prisma`, migraciones, logica de negocio y `package.json` (el lint se corrio con `npx --yes`, sin instalar nada). Sin cambios de comportamiento: lo unico fuera del YAML es una linea de `main.ts`.

### Verificacion

- `npx tsc --noEmit`: limpio. `npm run build`: OK. `npm run test:unit`: **244/244** (33 archivos).
- `npx --yes @redocly/cli lint docs/openapi.yaml`: **valido (OpenAPI 3.0.3), 0 errores, 5 warnings, todos preexistentes**: `no-server-example.com` (servidor `localhost`, linea 21); `no-invalid-media-type-examples` en `listarUsuarios` y `listarSocios` (el `example` de la respuesta 200 sigue siendo un array y el schema ahora es `{ items, total }`); y `no-invalid-schema-examples` x2 en `IngresoOut` (el `example` no trae `nombre` ni `dni`, que son `required`).
- Servidor levantado con `node dist/main` (puerto del `.env`, base de Supabase) y `GET /docs-json`: **51 operaciones en el codigo y 51 en el YAML, 14 tags declarados en cada uno, 0 diferencias** en (metodo, path, `operationId`), tags por operacion, tags declarados (por conjunto) y `security` por operacion. Contra el YAML de `HEAD` el mismo script marca 2 diferencias (`ingresos` y `esperas-clases`), asi que el chequeo detecta lo que se corrigio. El servidor se apago al terminar (antes de la medianoche, para que no corrieran los crons de renovacion y de membresias sobre la base compartida).
- **No se corrieron** `npm run test:integration` ni `npm run test:e2e`: no hay cambios de comportamiento en este paso.
- **Comparador historico de `backend/contrato/`: no se corrio**, ver pendientes.

### Commits

Mensajes sugeridos (sin hash):

- `docs(api): corrige los $ref rotos de los listados y agrega securitySchemes y tags faltantes en openapi.yaml`
- `fix(api): declara el tag reportes en el DocumentBuilder`
- `docs(log): registra el cierre del contrato OpenAPI contra el codigo (17/10)`

### Pendientes que siguen abiertos

1. **`/auth/refresh` y `/auth/logout`:** se agregan al YAML junto con la implementacion de la sesion (paso siguiente), no antes.
2. **Comparador de contrato sin restaurar:** el de `backend/contrato/` sigue sin estar en el checkout. Lo verificado en esta entrada es solo el lint mas el chequeo de operaciones, tags y security; la comparacion de schemas, parametros, respuestas y `required` contra `/docs-json` queda sin correr.
3. **Warnings preexistentes del lint (5):** los `example` de `listarUsuarios` y `listarSocios` (siguen siendo array) y el de `IngresoOut` (faltan `nombre` y `dni`) no se corrigieron: quedaban fuera del alcance de este paso.
4. **Orden de tags distinto** entre el codigo y el YAML (el conjunto coincide). Alinearlo si importa el orden en Swagger UI.

---

## 2026-10-18 - Sesión con refresh token y logout (decisión A del equipo)

**Fecha:** 18/10/2026 · **Rama:** `main`

### Actividades

1. **Modelo y migración.** Modelo `RefreshToken` en `prisma/schema.prisma` (id, `usuario_id` con `onDelete: Cascade`, `token_hash` único, `familia` uuid, `expira_en`, `usado_en` y `revocado_en` nullables, `creado_en`), con índices en `usuario_id` y `familia` (el unique de `token_hash` ya crea el índice de búsqueda) y la relación inversa en `Usuario`. Migración `20261018120000_refresh_token` generada **sin conectarse a ninguna base** con `prisma migrate diff --from-schema-datamodel <schema de HEAD> --to-schema-datamodel <schema nuevo> --script`. El SQL solo hace `CREATE TABLE "RefreshToken"`, sus 3 índices y la FK: no toca nada existente.

2. **Variables de entorno** (`config/env.config.ts` y `.env.example`): `JWT_EXPIRES_IN` pasa de 3600 a **900**; `REFRESH_EXPIRES_IN` (604800), `CORS_ORIGINS` (lista separada por coma, `http://localhost:5173`), `REFRESH_COOKIE_SAMESITE` (`strict|lax|none`, `lax`) y `REFRESH_COOKIE_SECURE` (booleano; sin valor es `true` solo con `NODE_ENV=production`). Con `SAMESITE=none` y Secure en false, el arranque falla con `REFRESH_COOKIE_SAMESITE='none' exige REFRESH_COOKIE_SECURE=true`. Nada dependía del 3600 salvo el `example` de `LoginOut` (ajustado a 900).

3. **`AuthService`.** El payload y la firma del access token salieron de `login()` a un método privado que usan `login` y `refrescar`, así emiten el mismo payload y el mismo `LoginOut`. Refresh token opaco (`randomBytes(32)` en base64url); en la base solo su SHA-256 en hex. Cada login abre una familia nueva. `refrescar(token)`: inexistente, vencido o revocado → 401; ya usado, o `marcarUsado` (UPDATE condicionado a `usado_en IS NULL`) que afecta cero filas → reuso: revoca **todas** las sesiones del usuario y 401; válido → marca usado, relee el usuario (rol y sede actualizados; si no existe, 401) y emite refresh nuevo en la misma familia más access nuevo. `cerrarSesion(token)` revoca la familia y siempre termina bien. Todos los errores de refresh son el mismo 401 (`sesionInvalida()`).

4. **Repositorio.** `RefreshTokenRepository`, clase concreta `@Injectable()` en `auth/repositories`, registrada en `AuthModule`. Sin puerto ni clase abstracta.

5. **Controller, cookie, CORS y CSRF.** `POST /auth/refresh` (`refrescarToken`) y `POST /auth/logout` (`cerrarSesion`, 204), públicos. El token llega por body (`RefreshIn`) o por la cookie `refresh_token` (si vienen los dos, manda el body) y la respuesta de refresh vuelve por el mismo canal. En login, con `X-Cliente: movil` el refresh va en `LoginOut.refreshToken` y no hay cookie; sin ese header, solo cookie. Cookie: HttpOnly, `Path=/api/v1/auth`, `Max-Age=REFRESH_EXPIRES_IN`, SameSite y Secure por variables. Con el token por cookie, refresh y logout exigen `Origin` dentro de `CORS_ORIGINS`; si no, 403 `https://fitzone.app/errores/origen-no-permitido`. `main.ts`: `enableCors` con lista explícita de orígenes, `credentials: true`, headers `Content-Type`, `Authorization`, `X-Cliente`, `Idempotency-Key` y `Location` expuesto. Helper `commons/cookies.ts` para leer la cookie de `req.headers.cookie` (sin `cookie-parser`, sin dependencias nuevas).

6. **Contrato `docs/openapi.yaml`.** Paths `/auth/refresh` y `/auth/logout` (antes de `/auth/registro-qr`; logout sin `security`), schema `RefreshIn`, `LoginOut.refreshToken`, header `X-Cliente` en login, `Set-Cookie` en los 200 de login y refresh y en el 204 de logout, 403 en refresh y logout. De paso, corregidos los 3 warnings de ejemplos del lint anterior: los `example` de 200 de `listarUsuarios` y `listarSocios` ahora son `{ items, total }` e `IngresoOut` incluye `nombre` y `dni`.

7. **Tests.** Unit: `AuthService` con repositorio en memoria, controller (borrado de cookie), helper de cookie y Origin, `leerCookie`, validación de entorno y `UsuariosService.buscarParaAutenticarPorId`. E2E nuevo `test/e2e/auth/sesion.e2e-spec.ts` (16 tests); `auth.e2e-spec.ts` no se tocó.

### Decisiones tomadas

1. **Cookie con `Path=/api/v1/auth`**, no `/auth`: el prefijo global `api/v1` hace que `/auth` no coincida con ninguna ruta real y el navegador nunca mandaría la cookie. Así solo viaja a las rutas de auth.
2. **Logout sin bearer.** Se autentica por el refresh token, igual que refresh. Un access token vencido no debe impedir cerrar la sesión. Es idempotente (204 con token desconocido, ya revocado o ausente).
3. **Canal por header `X-Cliente: movil`**, no por User-Agent: es explícito y no se puede inferir mal. Sin el header el refresh token nunca sale en el body.
4. **Vidas de 15 min (access) y 7 días (refresh) como valores por defecto, sin confirmar** con el equipo ni con la cátedra.
5. **SHA-256 y no bcrypt para el hash.** El refresh token ya es aleatorio de 256 bits (alta entropía): no hay diccionario que frenar, y el lookup indexado por hash es directo.
6. **Sin período de gracia en la rotación.** Dos refresh simultáneos con el mismo token cuentan como reuso (el test e2e de concurrencia lo fija: uno da 200, el otro 401, y queda todo revocado). **El front tiene que serializar la renovación** (una sola en vuelo, con las demás esperando su resultado).
7. **Excepción autorizada a "no tocar otros módulos": `UsuariosService.buscarParaAutenticarPorId(id)` en M1.** Refresh tiene que releer el usuario por id con rol y `sedeId`, y M1 solo exponía `buscarParaAutenticar(email)`; `obtenerPorId` devuelve `UsuarioOut` sin `sedeId`. La alternativa era que auth consultara `usuario`/`empleadoSede` por Prisma, contra ADR-07. El método comparte con `buscarParaAutenticar` el helper privado que resuelve `sedeId` (solo para RECEPCION), así que la forma de retorno es la misma; lleva su unit test. Es el único cambio fuera de auth y de los archivos de infraestructura (`env.config.ts`, `.env.example`, `main.ts`, `commons/cookies.ts`).
8. **La cookie se borra solo ante el 401 de sesión inválida.** En refresh por cookie, ante cualquier otro error (p. ej. un 5xx por la base) la cookie queda como está y el error se relanza: el token puede seguir siendo válido y borrarlo cerraría la sesión por una falla transitoria. En logout por cookie se borra siempre. El borrado usa `res.cookie` con `maxAge: 0` y no `clearCookie`, porque `clearCookie` de Express 5 descarta `maxAge` y no emite `Max-Age=0`.
9. **Sin token en body ni en cookie no se exige Origin:** refresh responde 401 y logout 204. Sin cookie no hay nada que proteger de CSRF, y exigir Origin ahí dejaba a logout sin ser idempotente.
10. **Reuso revoca todas las familias del usuario**, no solo la del token reusado: no se puede saber cuál de las dos copias es la legítima.
11. **Nombres del modelo:** `RefreshToken` con campos en snake_case (`token_hash`, `expira_en`, `usado_en`, `revocado_en`, `creado_en`), sin `@@map`, como el resto; se mantiene el término técnico en inglés porque así lo usan el contrato, la cookie y el DTO.
12. **El contrato no declara 422** para refresh y logout (se pidieron 200/204/401/403), igual que login, aunque un body inválido responde 422 por el `ValidationPipe`.
13. **Base de tests.** No hay Docker en esta máquina; se usó la base local vacía `fitzone_test` de `localhost:5432` que apunta `backend/.env.test`. Como estaba vacía, `prisma migrate deploy` aplicó las 19 migraciones (incluida la nueva) ahí. **Supabase no se tocó.** Observación: `docker-compose.test.yml` (en la raíz del repo) publica el puerto 5432 y `.env.test.example` apunta al 55432; no coinciden.
14. **`backend/README.md` no tiene sección de variables de entorno**, así que no se tocó; las variables nuevas quedaron documentadas en `.env.example`.

### Verificación

- `npx tsc --noEmit`: limpio. `npm run build`: OK. `npx prisma validate`: schema válido.
- `npm run test:unit`: **282/282** (39 archivos; antes 244).
- `npm run test:integration`: **53/53** (10 archivos; sin cambios), contra `fitzone_test` local.
- `npm run test:e2e`: **75/75** (20 archivos; antes 59, +16 de `sesion.e2e-spec.ts`), contra `fitzone_test` local.
- `npx --yes @redocly/cli lint docs/openapi.yaml`: válido, **0 errores, 1 warning** (`no-server-example.com`, servidor `localhost`, preexistente). Los tres warnings de ejemplos desaparecieron.
- Chequeo descartable contra `/docs-json` (servidor `node dist/main` en el puerto 3055 contra `fitzone_test` local, apagado al terminar): **53 operaciones en el código y 53 en el YAML, 14 tags declarados en cada uno, 0 diferencias** en (método, path, `operationId`), tags por operación, tags declarados (por conjunto) y `security` por operación. Mismas limitaciones que el del 17/10: no compara schemas, parámetros, respuestas ni `required`. El script no quedó en el repo.
- Smoke manual con `curl` contra ese servidor: login web (cookie `refresh_token` con `Path=/api/v1/auth`, HttpOnly, `Max-Age=604800`, `SameSite=Lax`); refresh por cookie sin Origin → 403; con Origin → 200 y cookie rotada; reuso de la cookie vieja → 401 con la cookie borrada (`Max-Age=0`); la cookie nueva tras el reuso → 401; logout → 204 con la cookie borrada; refresh tras el logout → 401; preflight CORS con el origen permitido devuelve los headers esperados y con un origen ajeno no devuelve `Access-Control-Allow-Origin`. El usuario del smoke se borró de la base local.
- **No se corrió nada contra Supabase** (ni migración, ni tests, ni smoke).

### Commits

Mensajes sugeridos (sin hash):

- `feat(auth): modelo y migración de refresh tokens`
- `feat(config): variables de sesión con refresh token y validación de SameSite none`
- `feat(m1): buscarParaAutenticarPorId en UsuariosService`
- `feat(auth): refresh con rotación, logout y cookie HttpOnly`
- `feat(api): CORS con credenciales y orígenes configurables`
- `test(auth): unit y e2e de la sesión con refresh token`
- `docs(api): refresh y logout en openapi.yaml y corrección de ejemplos`
- `docs(log): registra la sesión con refresh token y logout (18/10)`

### Pendientes que siguen abiertos

1. **Aplicar la migración en Supabase** con `prisma migrate deploy` (`20261018120000_refresh_token`).
2. **Limpieza de tokens vencidos o revocados:** no hay cron; la tabla `RefreshToken` solo crece (la cascada la vacía únicamente al borrar el usuario).
3. **Confirmar las vidas de los tokens** (15 min y 7 días) con el equipo.
4. **Front:** serializar la renovación (sin período de gracia) y guardar el access token solo en memoria.
5. **Cookie en producción:** definir `CORS_ORIGINS` y revisar `REFRESH_COOKIE_SAMESITE`/`REFRESH_COOKIE_SECURE` según el dominio del deploy (si el front y la API quedan en sitios distintos hace falta `none` + Secure).
6. **Smoke contra Supabase:** no se hizo; se hará cuando se aplique la migración.
7. **`docker-compose.test.yml` y `.env.test.example`** no coinciden en el puerto (5432 vs 55432).
8. **Comparador de contrato sin restaurar** (el de `backend/contrato/`): sigue la comparación de schemas, parámetros, respuestas y `required` sin correr.
9. **Orden de tags distinto** entre el código y el YAML (el conjunto coincide).

---

## 2026-10-18 - Correcciones menores de código, casos de uso de M3 y verificaciones de cierre

**Fecha:** 18/10/2026 · **Rama:** `main`

### Actividades

1. **Comentario "Plan M2, D5".** En `m2-gimnasio/repositories/ingreso.repository.ts` los dos comentarios que decían "ADR-08 D5" (lock pesimista de la fila Sede) pasan a "Plan M2, D5": es la decisión 5 del Plan de M2 y no tiene que chocar con el ADR-08 de Capas. Un grep de "ADR-08 D5" en el repo (sin `node_modules` ni `dist`) no encontró otras apariciones; sí hay una "ADR-08 D3" en `prisma/schema.prisma` (comentario de `Ingreso.validado_offline`), que no se tocó.

2. **Errores de Prisma por el mapper.** `CanchaRepository.actualizar` y `PagoRepository.anular` capturaban el `P2025` a mano (`instanceof PrismaClientKnownRequestError` y `error.code`); ahora preguntan `mapearErrorPrisma(error) === 'NO_ENCONTRADO'`, como el resto de los repositorios. Siguen devolviendo `null` y el service sigue traduciendo a 404: la respuesta HTTP no cambia. `anular` ya tenía su test; `CanchaRepository.actualizar` no tenía cobertura del camino de "no existe", así que se agregó `cancha.repository.spec.ts` (3 tests: P2025 → `null`, otro código de Prisma y error ajeno se relanzan).

3. **`turnoOcupadoBody` fuera de M4.** El cuerpo del 409 `turno-ocupado` se movió de `m4-canchas/errors/reserva.errors.ts` a `commons/errors/turno-ocupado.ts`. El `ProblemFilter` ahora lo importa de ahí y `reserva.errors.ts` lo importa de commons para armar `turnoOcupado()`. Mismo `type`, `title`, `detail` y `status`.

4. **El bus de eventos como Observer.** `README.md` (sección de eventos) ya no presenta el bus como Mediator: es el Observer del proyecto (RF-08) y el cobro interno (RF-02/RF-07) lo aprovecha para que M1 y M3 no importen a M5. `m5-pagos/pagos.module.ts`: "por el event bus (Mediator)" pasa a "por el event bus".

5. **Casos de uso de M3** (`docs/UserCaseDiagrams/Modulo3_Clases_CasosDeUso.md`). UC-03: la vigencia la consulta `MembresiasService` (M1, ADR-09) y las validaciones previas corren en cadena (ADR-10); la precondición usa `ahora >= horarioInicio - 48h`; la reserva anticipada responde 409 (no 422) y se agrega el flujo 3e (`clase-pasada`). UC-04: el paso 2 describe "la clase no comenzó" y la penalidad del 50% como `Pago` con concepto `RESERVA_CLASE`; el paso 4 habla del evento `EVENTO_CUPO_LIBERADO` con `emitAsync`; el flujo 2a "Fuera de término" se reemplaza por 2a (cancelación tardía con penalidad, 402 si la pasarela rechaza) y 2b (clase ya comenzada, `reserva-clase-pasada`); la fila de trazabilidad y la etiqueta del diagrama se ajustan. UC-07: el disparador usa `EVENTO_CUPO_LIBERADO`. El actor "Mediador de Pagos (M5)" pasa a "Pagos (M5)" (nodo `PagosM5`).

### Decisiones tomadas

1. **`pago.repository.ts` `crear` (P2002) no pasó por el mapper.** Para elegir el motivo (`IDEMPOTENCIA_REPETIDA` o `RESERVA_YA_COBRADA`) hace falta `meta.target` del error, y `mapearErrorPrisma` solo devuelve la causa (`UNIQUE`). Cambiarlo sin tocar la respuesta exigiría ampliar el mapper (por ejemplo una función que devuelva el objetivo de la constraint) y eso es una decisión de diseño; se dejó como estaba y queda en Pendientes.
2. **`commons` todavía importa tipos de módulos.** El pedido era sacar `turnoOcupadoBody`, y eso está hecho (el filtro ya no importa de M4). Pero `commons/guards/roles.guard.ts` y `roles.decorator.ts` importan `RolUsuario` (M1) y `UsuarioAutenticado` (auth) como `import type`, y `commons/fechas.spec.ts` importa `TIMEZONE_SEDE` de M4. Moverlos implica tocar auth o M1; no se hizo.
3. **Casos de uso: lo que el código decía distinto del texto pedido.** (a) B5 y B7: el documento ya no decía `CupoLiberadoSubject` (el paso 4 de UC-04 decía "publica el evento de dominio `reservaClase.cupoLiberado` en el bus" y el paso 1 de UC-07 "El bus despacha el evento ... a los oyentes `@OnEvent`"), así que el paso 1 de UC-07 se dejó como estaba, porque ya es correcto, y solo se cambió el disparador. (b) 2a: la cancelación con la pasarela rechazando el cobro no "se revierte": la penalidad se cobra antes y, si falla, la reserva nunca deja de estar `CONFIRMADA`; el texto dice "no se aplica". (c) 2b: el código rechaza con `reserva-clase-pasada` desde `ahora >= horarioInicio` (`puedeCancelar` del estado CONFIRMADA), no desde que la reserva figura como `CUMPLIDA` (`ahora >= horarioFin`); el texto dice las dos cosas por separado. (d) B8: además de las tres apariciones listadas había una cuarta, en la 3a de UC-03 ("vía el Mediador M5"); pasó a "vía Pagos (M5)" para que el archivo no tenga ninguna mención. (e) En la 3a de UC-03 el `type` del socio en mora sigue siendo `socio-en-mora` (verificado). Verificados contra el código: slugs `reserva-anticipada-no-permitida`, `clase-pasada` y `reserva-clase-pasada` (los tres 409), concepto `RESERVA_CLASE`, penalidad 50% (`PORCENTAJE_PENALIDAD_CANCELACION_TARDIA = 0.5`), 402 del cobro rechazado, `EVENTO_CUPO_LIBERADO`, orden de la cadena (ClaseExiste, SocioAlDia, ReservaAnticipada, ClaseNoComenzada).
4. **ADR-05 y ADR-09 para el Observer.** El texto de UC-04 cita ADR-05 (como se pidió); en el código ADR-05 aparece en el aviso por email de cupo liberado (RF-08) y el README atribuye el desacople por bus a ADR-09. No se resolvió cuál corresponde.
5. **Sin cambios de contrato.** `docs/openapi.yaml` y `prisma/schema.prisma` no se tocaron en este paso.

### Verificación

Contra `fitzone_test` (`localhost:5432`), con `DATABASE_URL` leída de `backend/.env.test` y el destino comprobado antes de correr (host, puerto y nombre de base, sin credenciales):

- `npx tsc --noEmit`: limpio. `npm run build`: OK (exit 0). `npx prisma validate`: schema válido.
- `npm run test:unit`: **285/285** (40 archivos; antes 282/39: +3 tests en `cancha.repository.spec.ts`).
- `npm run test:integration`: **53/53** (10 archivos, sin cambios).
- `npm run test:e2e`: **75/75** (20 archivos, sin cambios).
- `npx --yes @redocly/cli lint docs/openapi.yaml`: válido, **0 errores, 1 warning** (`no-server-example.com`, preexistente).
- Chequeo descartable contra `/docs-json` (`node dist/main` en el puerto 3055 contra `fitzone_test`, apagado al terminar; mismo script del paso anterior, fuera del repo): **53 operaciones en el código y 53 en el YAML, 14 tags declarados en cada uno, 0 diferencias** (método, path, `operationId`, tags por operación, tags declarados y `security` por operación). No compara schemas, parámetros ni respuestas.
- El diagrama Mermaid de M3 no se renderizó (no hay un validador en el entorno): el cambio es solo el renombre del nodo (`MediadorPagos` → `PagosM5`) en sus tres apariciones y las etiquetas de texto.
- **No se corrió nada contra Supabase.**

### Commits

Mensajes sugeridos (sin hash):

- `docs(m2): referencia "Plan M2, D5" en los comentarios del lock de ingresos`
- `refactor(m4,m5): P2025 de cancha y de anulación de pago por el mapper de errores de Prisma`
- `test(m4): cobertura del P2025 de CanchaRepository.actualizar`
- `refactor(commons): mueve turnoOcupadoBody de m4-canchas a commons/errors`
- `docs: el bus de eventos es el Observer, no un Mediator (README y pagos.module)`
- `docs(m3): alinea los casos de uso de M3 con el código (cancelación con penalidad, cadena de validaciones y bus de eventos)`
- `docs(log): registra correcciones de código, casos de uso de M3 y verificaciones (18/10)`

### Pendientes que siguen abiertos

De este paso:

1. **`PagoRepository.crear` (P2002)** sigue traduciendo a mano porque necesita `meta.target`: decidir si el mapper expone el objetivo de la constraint.
2. **`commons` importa tipos de módulos:** `RolUsuario` (M1) y `UsuarioAutenticado` (auth) en los guards, y `TIMEZONE_SEDE` (M4) en `fechas.spec.ts`.
3. **Menciones que quedan de Mediator/Mediador** (sin cambiar): `docs/Reparto_Modulo1_FitZone.md` línea 70 ("vía Mediador M5"), `m5-pagos/pagos.module.ts` línea 16 ("puerto del Mediador"), `m5-pagos/entities/solicitud-cobro.entity.ts` línea 3 y `m5-pagos/entities/pago.entity.ts` línea 6 (rutas históricas `commons/mediador/`).
4. **"ADR-08 D3"** en `prisma/schema.prisma` (comentario de `Ingreso.validado_offline`): mismo patrón que el D5 corregido, probablemente también sea una decisión del Plan de M2.
5. **`cancelacionFueraDeTermino()`** (`m3-clases/errors/reservas-clases.errors.ts`) ya no la usa nadie ni figura en el contrato: la cancelación tardía ahora cobra penalidad. Código muerto a borrar.
6. **ADR del Observer:** definir si el texto de UC-04 cita ADR-05 o ADR-09.
7. **Diagrama Mermaid de M3** sin renderizar.

Arrastrados de entradas anteriores:

8. **Tabla `RefreshToken` sin limpieza** de vencidos o revocados (no hay cron).
9. **Vidas de los tokens** (15 min y 7 días) sin confirmar con el equipo.
10. **CORS y cookie para el deploy:** definir `CORS_ORIGINS` y revisar `REFRESH_COOKIE_SAMESITE`/`REFRESH_COOKIE_SECURE` según el dominio.
11. **Front:** serializar la renovación (sin período de gracia) y guardar el access token solo en memoria.
12. **Smoke de la sesión contra Supabase:** sin hacer.
13. **Orden de tags distinto** entre el código y el YAML (el conjunto coincide).
14. **Comparador de schemas, parámetros, respuestas y `required` sin restaurar** (el de `backend/contrato/`).
15. **`docker-compose.test.yml` y `.env.test.example`** no coinciden en el puerto (5432 vs 55432).

---

## 2026-10-21 - Cierre del scaffolding del frontend (SCRUM-15) — Santino Mazzulla (P3 - Frontend Developer)

**Fecha:** 21/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Proyecto base en `frontend/`.** Vue 3 + Vite + TypeScript + Vue Router + Pinia, creado con `npm create vue@latest` de forma no interactiva (create-vue 3.24.0, flags `--ts --router --pinia`; sin Vitest, JSX, Playwright, ESLint ni Prettier, que se ven más adelante). Se borraron los archivos de ejemplo de la plantilla (componentes demo, store `counter`, `AboutView`, logo, `base.css`) y `App.vue` quedó con un `<RouterView />`. `src/assets/main.css` es un reset mínimo (box-sizing, `margin: 0` en `body`, fuente del sistema), sin layout sobre `#app`.

2. **Estructura de carpetas.** `ui/` con `atomos/`, `moleculas/`, `organismos/`, `plantillas/`, `tokens/` y un `index.ts` que por ahora solo documenta que es la API pública del kit; `features/sesion/` y `features/socios/`, cada una con `pages/`, `components/`, `composables/`, `services/` y `stores/`; más `compartido/` (utilidades y cosas sin dueño), `types/` y `router/`. Las carpetas sin archivos llevan `.gitkeep`.

3. **Páginas de referencia y rutas.** `LoginPage` y `GestionSociosPage` como stubs (un `<h1>`, sin lógica). Rutas con carga diferida (import dinámico): `/` redirige a `/login`, `/login` (`login`) y `/socios` (`socios`). Todavía sin guards: la sesión viene después.

4. **Tipos de la API.** `openapi-typescript` 7.13.0 como devDependency y script `types:api` (`openapi-typescript ../docs/openapi.yaml -o src/types/api.d.ts`). El `src/types/api.d.ts` generado tiene 3.728 líneas, encabezado de archivo autogenerado y exporta `paths`, `components` y `operations`: **53 operaciones y 61 schemas**.

5. **Variables de entorno y README.** `frontend/.env.example` con `VITE_API_URL=http://localhost:3000/api/v1` (puerto y prefijo `api/v1` leídos de `backend/src/main.ts` y `env.config.ts`), `.env` y `.env.local` en el `.gitignore` del front, `ImportMetaEnv` tipado en `env.d.ts` y `src/compartido/config.ts`, que exporta `API_URL` y lanza un error claro si falta la variable. `frontend/README.md` reescrito en español (qué es, requisitos, primeros pasos, scripts, estructura, variables de entorno, CORS con `CORS_ORIGINS`, tipos de la API y sesión pendiente).

### Decisiones tomadas

1. **El frontend vive en `frontend/` del mismo repo** (monorepo, igual que el backend). Queda por confirmar con el profe que cuente como "repositorio frontend documentado" (ver Pendientes).
2. **Regla de dependencias: `ui/` no importa nada de `features/`.** Queda escrita al inicio de `ui/index.ts` y en el README.
3. **El archivo de tipos generado se versiona** y se regenera con `npm run types:api` cada vez que cambia el contrato. No se edita a mano; el README lo dice.
4. **TypeScript fijado en `~5.9`** (instalado 5.9.3, una sola versión en todo el árbol) porque `openapi-typescript` declara un peer dependency de TypeScript 5. El README lo deja anotado: subir a 6 cuando el generador lo soporte.

### Problemas encontrados

1. **ERESOLVE al instalar `openapi-typescript`.** `create-vue` dejó `typescript ~6.0.0` (6.0.3) y `openapi-typescript@7.13.0` declara `peer typescript@"^5.x"`, así que `npm install -D openapi-typescript` falló. No se usó `--force` ni `--legacy-peer-deps`: se presentaron las opciones y se resolvió bajando TypeScript con `npm install -D typescript@~5.9` y luego instalando el generador sin conflicto. `vue-tsc` y los tsconfig generados siguen funcionando con TS 5.9.
2. **Warnings de engine en `npm install`.** Algunas dependencias transitivas piden Node `^24.15.0` o `^22.22.2` y la máquina de Santino tiene la v24.14.1. Solo son warnings y todo funcionó; queda como pendiente definir la versión de Node del equipo.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0** con TypeScript 5.9, tras cada paso (proyecto base, estructura, tipos, variables de entorno).
- Conteo de operaciones: las **53** claves únicas de `operations` en `api.d.ts` coinciden con los **53** `operationId` únicos de `docs/openapi.yaml`.
- No se usó ningún `.env` real (solo se creó `.env.example`; del backend solo se leyeron `.env.example`, `main.ts` y `env.config.ts`).
- No se tocó el backend ni `docs/openapi.yaml`, que solo se leyó.
- El servidor de desarrollo se levantó a mano (`npm run dev`) con el `.env` copiado de `.env.example`: `/` redirige a `/login`, `/socios` carga `GestionSociosPage` y la consola del navegador no muestra errores. `config.ts` todavía no lo importa ningún módulo, así que el build no ejercita el error de variable faltante.

### Commits

- `bff93fd` `feat(front): scaffolding base del frontend con Vue 3, Vite, TypeScript, Router y Pinia`
- `5021c2b` `feat(front): estructura ui y features, páginas de referencia y rutas base`
- `53df3c7` `feat(front): tipos de la API generados con openapi-typescript desde el contrato`
- `ae166ae` `feat(front): variables de entorno, config de la API y README del frontend`
- `ccd3637` `docs(log): registra el cierre del scaffolding del frontend (21/10)`

### Pendientes que siguen abiertos

1. **Sesión y tienda Pinia** (SCRUM-16).
2. **Cliente de la API tipado** con manejo de errores `problem+json` (SCRUM-17).
3. **Sistema de diseño y átomos** (SCRUM-15).
4. **Confirmar con el profe el 22/10** que el frontend dentro del monorepo cuenta como "repositorio frontend documentado".
5. **Definir la versión de Node del equipo:** el `engines` del front pide `^22.18.0` o `>=24.12.0`.

---

## 2026-10-23 - Tokens de diseño y átomos base del frontend (SCRUM-15)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Tokens de diseño en `frontend/src/ui/tokens/`, en tres niveles.** `primitivos.css` (único lugar con colores hexadecimales), `semanticos.css` (referencian solo primitivos; un modo oscuro se hará reasignando esta capa) y `componentes.css` (referencian solo semánticos), más `index.css` que los reúne. `src/assets/main.css` importa `index.css` y su reset usa tokens semánticos. `index.html` carga Inter desde Google Fonts.

2. **Tres átomos en `src/ui/atomos/`.** `BotonFz` (variantes primario, secundario, peligro y fantasma; tamaños sm, md y lg; estado cargando), `CampoTextoFz` (`v-model` con `defineModel`, estado `invalido`) e `InsigniaFz` (neutra, exito, peligro y advertencia). Se exportan desde `ui/index.ts`.

3. **`ui/README.md`.** Guía de contribución del kit: niveles, nombres con sufijo `Fz`, convenciones de API, regla de tokens y cómo agregar un componente.

### Decisiones tomadas

1. **Contraste.** Al verificar con WCAG 2.2 AA, 4 de los 6 pares principales quedaban por debajo de 4.5:1: texto-suave sobre fondo (4.48), el blanco sobre el azul primario `#2383E2` (3.88), éxito sobre su fondo (4.4996, que se redondea a 4.50 pero no llega) y advertencia sobre su fondo (3.54). Se oscurecieron cinco valores respecto de la paleta del prototipo: gris-500 `#787774` -> `#73726e`, azul-500 `#2383e2` -> `#1a6ec1`, azul-600 `#1a6ec1` -> `#165ca0`, ambar-700 `#b57418` -> `#9a610f` y verde-700 `#2a7e4b` -> `#287447`. Los semánticos y los tokens de componente no cambiaron porque referencian por nombre. La accesibilidad prevalece sobre la fidelidad al prototipo.
2. **Texto deshabilitado sobre el gris de hover** queda en 4.26:1: se acepta porque WCAG exime a los componentes deshabilitados.
3. **Botón peligro.** No hay token `peligro-hover`, así que se hizo "suave" (fondo y borde del estado, texto rojo) y en hover pasa a rojo sólido con texto blanco (5.19:1).
4. **Tamaños.** `md` y `lg` comparten tamaño de texto y se diferencian por alto y relleno. El botón `sm` tiene alto mínimo de 32 px (WCAG 2.2 pide 24 px).
5. **Sin dependencias nuevas:** `package.json` y `package-lock.json` no cambiaron. Reka UI sigue sin instalarse hasta que haya un widget complejo.

### Problemas encontrados

1. **Contraste por debajo de 4.5:1.** El chequeo de contraste detectó el problema descrito arriba antes de commitear; se corrigió ajustando los cinco primitivos.
2. **Push rechazado (non-fast-forward)** por un commit de Exequiel; se resolvió con `git pull --rebase` y por eso el commit quedó con otro hash.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- Colores literales solo en `primitivos.css`; ningún `var(--fz-prim-...)` fuera de `semanticos.css`; capas de tokens respetadas; todas las variables usadas están definidas.
- Los átomos todavía no los importa ninguna página: el type-check los revisa pero no se vieron en pantalla. La comprobación visual queda para la `LoginPage`.

### Commits

- `4a719f4` `feat(front): tokens de diseño, átomos base y guía del kit`

### Pendientes que siguen abiertos

1. **Molécula `CampoFormularioFz` y `LoginPage`** armada con estas piezas (primera comprobación visual de tokens y átomos).
2. **Base compartida:** cliente HTTP, store de sesión, guards del router y raíz de composición con inyección de servicios (a confirmar con el equipo).
3. **Instalar Reka UI** al construir el primer widget complejo.
4. **Consultar al profe** si espera Storybook y tokens en formato DTCG.
5. **Confirmar la versión de Node del equipo.**
6. **Marcar SCRUM-15 en Jira** cuando cierre el scaffolding.

---

## 2026-10-23 - Pantalla de login visual y cadena de componentes del kit (SCRUM-15)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Molécula `CampoFormularioFz` (`ui/moleculas/`).** Etiqueta con `for`, `CampoTextoFz`, ayuda y error opcionales. El `id` se genera con `useId()` si no se pasa. `aria-describedby` apunta a la ayuda y al error, el error lleva `role="alert"` y los atributos no declarados se reenvían al campo.

2. **Plantilla `PlantillaCentradaFz` (`ui/plantillas/`).** Pantalla completa con una tarjeta centrada de ancho máximo 24 rem. El `titulo` se renderiza como `h1` y el `subtitulo` como `p`.

3. **Átomo `AvisoFz` (`ui/atomos/`).** Variantes `peligro`, `exito` y `advertencia`; `role="alert"` para peligro y advertencia y `role="status"` para éxito.

4. **Tokens de componente nuevos** (`--fz-campo-formulario-*`, `--fz-plantilla-centrada-*` y `--fz-aviso-*`) en `componentes.css`, todos referenciando semánticos. Los tres componentes nuevos se exportan desde `ui/index.ts`.

5. **Organismo `FormularioLogin` (`features/sesion/components/`).** Email y contraseña, botón "Ingresar", props `cargando` y `error` y evento `enviar` con `{ email, contrasenia }`. Va en `features/` y no en `ui/` porque conoce conceptos de sesión.

6. **`LoginPage`** reemplaza el stub y compone la plantilla con el organismo. No llama a la API: la conexión es SCRUM-16.

### Decisiones tomadas

1. **Validación de UX solamente:** email obligatorio con formato razonable y contraseña obligatoria, sin largo mínimo. Los errores aparecen tras el primer intento de envío y se limpian al corregir el campo; el formulario usa `novalidate`. Si las credenciales son correctas lo decide el backend (401); el front lo mostrará con la prop `error` del organismo al conectar SCRUM-16.
2. **Contraste del borde de controles.** El borde en reposo de los campos (`color-borde`, `#e9e9e6`) daba unos 1.2:1, por debajo del 3:1 que pide WCAG 2.2 (1.4.11). Se agregó el primitivo `gris-300` (`#8c8b87`) y el semántico `borde-control`, que el campo usa en reposo (3.41:1 sobre blanco y 3.29:1 sobre la superficie). El semántico `borde` queda para separadores y tarjetas decorativos.
3. **Borde del botón secundario sin cambios.** El borde del secundario (en reposo y hover) y el de los botones deshabilitados siguen usando `color-borde` (~1.2:1). No se cambió porque ninguna pantalla usa todavía el secundario y el texto del botón lo identifica. A revisar cuando una pantalla lo use.
4. **La cadena de Atomic Design queda ejercitada de punta a punta:** átomos, molécula, plantilla, organismo y página.
5. **La molécula importa el átomo por ruta relativa** y no desde `ui/index.ts`, para evitar un ciclo de importación.

### Problemas encontrados

1. **Campos casi indistinguibles de la tarjeta.** La revisión visual en `/login` mostró que los campos casi no se distinguían de la tarjeta, lo que llevó al ajuste del borde descrito arriba.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- Colores literales solo en `primitivos.css`; ningún `var(--fz-prim-...)` fuera de `semanticos.css`; capas de tokens respetadas; todas las variables usadas definidas; `ui/` no importa nada de `features/`.
- Contraste de los pares nuevos: texto >= 4.5:1 (aviso de peligro 4.52, éxito 5.12, advertencia 4.74) y borde del campo >= 3:1.
- `package.json` y `package-lock.json` sin cambios.
- Comprobación manual de Santino en `/login` (escritorio y 375 px): sin scroll horizontal, anillo de foco visible al navegar con Tab, errores de validación al enviar vacío.

### Commits

- `2102431` `feat(front): molécula de formulario, plantilla centrada y LoginPage visual`

### Pendientes que siguen abiertos

1. **Base compartida del frontend:** cliente HTTP, store de sesión, guards del router y raíz de composición con inyección de servicios en `main.ts` (a confirmar con el equipo).
2. **Conectar `LoginPage` con el servicio de sesión** (SCRUM-16), incluyendo mostrar el error general.
3. **Revisar el borde del botón secundario** cuando una pantalla lo use.
4. **Repartir las pantallas de los demás módulos** entre el equipo una vez lista la base (a definir).
5. **Instalar Reka UI** al construir el primer widget complejo.
6. **Consultar al profe** si espera Storybook y tokens en formato DTCG.
7. **Confirmar la versión de Node del equipo.**
8. **Marcar SCRUM-15 en Jira.**

---

## 2026-10-23 - Cliente HTTP tipado, errores del contrato y raíz de composición (SCRUM-15)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Dependencia nueva: `openapi-fetch` 0.17.** Sin `peerDependencies` ni `engines`; solo depende de `openapi-typescript-helpers`. Instalación sin conflictos.

2. **`compartido/http/errores.ts`.** `ErrorApi` con `status` y `problema` (tipo derivado del esquema `Problem`, RFC 9457). La falla de red es un `ErrorApi` con status 0.

3. **`compartido/http/almacenToken.ts`.** El access token vive solo en memoria.

4. **`compartido/http/clienteApi.ts`.** Cliente tipado con los `paths` del contrato, con `credentials: 'include'` y `Authorization: Bearer`. Ante un 401 en operaciones que no son de autenticación renueva una vez y reintenta una vez, con un `fetch` propio que clona el `Request` antes del primer intento. Si la renovación o el reintento fallan, borra el token y avisa que la sesión expiró. Incluye el helper `desenvolver`, que devuelve los datos o lanza `ErrorApi`.

5. **`compartido/servicios.ts`.** Interfaz `Servicios`, `ServiciosKey` (`InjectionKey`) y `useServicios()`.

6. **`features/sesion/services/servicioSesion.ts`.** `iniciarSesion`, `renovar` y `cerrarSesion`, una función por operación del contrato (`login`, `refrescarToken`, `cerrarSesion`).

7. **`main.ts`** pasó a ser la raíz de composición: crea el almacén, el cliente y el servicio, y los provee con `app.provide`.

8. **`README.md`:** sección "Capa de servicios y raíz de composición".

### Decisiones tomadas

1. **Inyección de dependencias con `provide`/`inject`** (el equivalente en Vue al Context de React visto en la Unidad IV, Clase 2). `main.ts` es el único archivo que conoce las implementaciones concretas y el único que importa `API_URL`; las features usan `useServicios()` desde `setup` o composables; `ui/` nunca usa servicios.
2. **Sesión.** El access token vive en memoria y el refresh token en la cookie HttpOnly que gestiona el backend. El contrato dice que dos renovaciones con el mismo token cuentan como reuso y revocan todas las sesiones del usuario; por eso las renovaciones concurrentes comparten una sola promesa y todas las llamadas a `/auth/refresh` (automáticas o explícitas) se serializan.
3. **Login, refresh y logout no pasan por la lógica de renovación ante 401** (evita bucles); `registro-qr` sí.
4. **Una falla de red al renovar hoy cierra la sesión**, igual que cualquier otra falla de renovación. Se puede distinguir más adelante para no desloguear por un corte de conexión.
5. **`servicios.ts` (en `compartido/`) importa con `import type` el tipo `ServicioSesion` desde `features/`.** Es el costo de un contenedor central, aceptado.
6. **`openapi-fetch` es la única dependencia nueva:** tipa cada llamada desde `api.d.ts`.

### Problemas encontrados

1. **Ninguno bloqueante.** Los warnings de engine de npm son los habituales de otras dependencias.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0** (58 módulos).
- `API_URL` aparece solo en `config.ts` y `main.ts`. No hay `localStorage`, `sessionStorage` ni `document.cookie` en `src/` (la única coincidencia es un comentario).
- `ui/`, `router/`, `LoginPage` y los componentes sin cambios. El diff de `package.json` es solo la línea de `openapi-fetch`; el lock solo suma `openapi-fetch` y `openapi-typescript-helpers`.
- Prueba con `fetch` falso (11 casos, todos OK; el script quedó fuera del repo): 401 con una renovación y un reintento con el mismo cuerpo, reintento tras recarga sin token en memoria, 5 pedidos concurrentes con 401 que hacen una sola renovación, renovaciones explícitas y automáticas en paralelo sin solaparse, renovación fallida, reintento con 401, login con 401 sin disparar renovación, login correcto, logout 204, falla de red y error sin problem+json.
- **No se probó contra el backend real.**

### Commits

- `13d9b83` `feat(front): cliente HTTP tipado, errores del contrato y raíz de composición`

### Pendientes que siguen abiertos

1. **Paso 8:** store de sesión (Pinia), composable de login, guards del router y `LoginPage` conectada con el aviso de error.
2. **Probar el cliente contra el backend real** (`CORS_ORIGINS`, header `Origin` y cookie del refresh).
3. **Pasar la prueba del cliente a tests dentro del repo** cuando se configure Vitest (Unidad V).
4. **Decidir si una falla de red al renovar debe cerrar la sesión.**
5. **Escribir ADRs del front:** sesión y tokens, capa de servicios y justificación de librerías.
6. **Los pendientes anteriores siguen abiertos:** borde del botón secundario, repartir pantallas de los demás módulos, Reka UI, consulta al profe por Storybook y tokens DTCG, versión de Node del equipo y Jira.

---

## 2026-10-23 - Sesión, rutas protegidas y login conectado al backend (SCRUM-16)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Store de sesión (`features/sesion/stores/sesionStore.ts`, Pinia).** Guarda el usuario (`rol`, `sedeId`, `socioId`) y si la sesión ya se intentó restaurar. Acciones `iniciarSesion`, `restaurar` (una sola vez, con la cookie de refresh), `cerrarSesion` y `limpiar`. No guarda el token ni usa ningún storage.

2. **Composable `useIniciarSesion`.** Expone `iniciarSesion`, `cargando` y `error`; traduce el 401, la falla de red y el resto de los errores a mensajes en español. Al éxito navega al `?redirect` si es una ruta interna válida y, si no, a la ruta inicial del rol.

3. **Guard global de rutas (`router/index.ts`).** Cada ruta declara su `meta` (`publica` o `roles`). En la primera navegación restaura la sesión; sin sesión manda a `/login?redirect=<ruta>`; con sesión, `/login` y las rutas no permitidas llevan a la ruta inicial del rol (`/socios` para RECEPCION y GERENTE, `/inicio` para el resto).

4. **`InicioPage`** (`features/inicio/pages/`), un stub con `<h1>Inicio</h1>` que solo requiere sesión.

5. **`LoginPage` conectada** al servicio de sesión a través del composable y el store, pasando `cargando` y `error` al formulario. `main.ts` provee los servicios antes de instalar el router y, al expirar la sesión, limpia el store y lleva a `/login`.

6. **`README.md`:** sección "Sesión y rutas protegidas".

### Decisiones tomadas

1. **El rol se deriva del schema `Rol` del contrato**, porque `LoginOut.rol` viene como `string` sin enum. Un rol desconocido queda sin permisos (`rol: null`): no entra a rutas con `roles`, pero sí a `/inicio`, para no quedar atrapado en un bucle.
2. **`/socios` queda restringida a RECEPCION y GERENTE** por decisión del equipo. Es solo una restricción de navegación: el contrato no dice qué roles operan con socios y el backend hoy no la hace cumplir.
3. **Las páginas no usan `fetch`**; el servicio de sesión lo conoce solo el store, y `LoginPage` llega a él a través del composable.

### Problemas encontrados

1. **Ruta inexistente con sesión: pantalla en blanco.** Falta una ruta comodín que redirija a la ruta inicial del rol. Se resuelve en el Paso 9.
2. **Backend: `POST /usuarios` acepta altas sin autenticación.** Los controladores de usuarios, socios y membresías no tienen `@UseGuards` ni `@Roles`. Se suma a lo que falta cerrar en seguridad.
3. **Usuarios de prueba en la base compartida.** La prueba manual dejó dos usuarios creados por `POST /usuarios`; hay que borrarlos o reconocerlos con el equipo.
4. **El front pierde la sesión ante una falla de red al renovar**, porque no la distingue de un 401.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- **El guard y el store no se pudieron probar en ejecución con Node** (el bundle de prueba no fue viable). Los bucles de redirección se razonaron a mano: sin sesión solo se redirige a `/login` (pública) y cada rol puede entrar a su ruta inicial.
- Prueba manual contra el backend real (Supabase), con dos usuarios de prueba creados por `POST /usuarios` (un GERENTE y un EXTERNO):
  - sin sesión, `/socios` redirige a `/login?redirect=/socios`;
  - con una contraseña incorrecta aparece el aviso de error (401 en la consola);
  - el GERENTE entra a `/socios` y la sesión se restaura con F5 (el refresh por cookie funciona y el CORS está bien);
  - el EXTERNO cae en `/inicio`, `/socios` lo devuelve a `/inicio` y `/login` con sesión también lo manda a `/inicio`.
- **No probado:** RECEPCION, SOCIO, la expiración de la sesión con la app abierta (`alExpirarSesion`) ni la falla de red al renovar.

### Commits

- `6e96a84` `feat(front): sesión con store de Pinia, guards por rol y login conectado`

### Pendientes que siguen abiertos

1. **Ruta comodín** que redirija a la ruta inicial del rol (Paso 9).
2. **Probar con RECEPCION y SOCIO**, la expiración de la sesión con la app abierta y la falla de red al renovar.
3. **Backend:** cerrar `POST /usuarios` sin autenticación y sumar `@Roles` a `/socios` y a las membresías.
4. **Borrar o reconocer con el equipo los usuarios de prueba** de la base compartida.
5. **Decidir si una falla de red al renovar debe cerrar la sesión.**
6. **Los pendientes anteriores siguen abiertos:** ADRs del front, tests del cliente con Vitest (Unidad V), borde del botón secundario, repartir pantallas de los demás módulos, Reka UI, consulta al profe por Storybook y tokens DTCG, versión de Node del equipo y Jira.

---

## 2026-10-23 - Armazón de la app, rutas por módulo y ruta comodín (SCRUM-16)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Rutas por módulo.** Cada feature exporta sus rutas en `features/<x>/rutas.ts` (`sesion`, `inicio` y `socios`) y `router/index.ts` las junta con spread, para que dos personas que agregan módulos no editen las mismas líneas. `RouteMeta` suma `navegacion?: { etiqueta, orden }`.

2. **Plantilla `PlantillaAppFz` (`ui/plantillas/`).** Presentacional, con slots `encabezado`, `navegacion`, `acciones` y contenido. Tokens `--fz-armazon-*` sobre semánticos. Landmarks `header`, `nav` y `main`, enlace "Saltar al contenido" y `aria-label` en el `nav`.

3. **`app/ArmazonApp.vue`.** Arma el armazón con links construidos desde las rutas con `meta.navegacion`, filtrados por `rolPermitido` y ordenados por `orden`. El botón "Cerrar sesión" usa `cerrarSesion()` del store y va a `/login` aunque falle el aviso al servidor.

4. **Ruta comodín `no-encontrada`.** Redirige a `/login`; con sesión, el guard reubica a la ruta inicial del rol. `useIniciarSesion` ignora un `?redirect` que apunte a la comodín. El nombre de la ruta vive como constante en `acceso.ts` para evitar un ciclo de imports entre el router y la feature.

5. **`README.md`:** estructura actualizada y sección "Rutas por módulo y armazón" con los 4 pasos para agregar un módulo.

### Decisiones tomadas

1. **El link inactivo usa `color-texto` y no `texto-suave`**, porque sobre el gris de hover daría 4.26:1 (mínimo 4.5:1). El activo se distingue por subrayado, peso y fondo.
2. **La comodín siempre va a `/login` y el guard resuelve el resto**, así no se toca el guard.
3. **Se agregó un slot `acciones` a la plantilla** para ubicar el botón sin acoplarla a la sesión.

### Problemas encontrados

1. **Ninguno.**

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- Sin `fetch` en `features/`, `router/`, `ui/` ni `app/`; `ui/` no importa `features/`, `compartido/` ni `app/`; colores literales solo en `primitivos.css`; sin variables sin definir; sin `localStorage`, `sessionStorage` ni cookies; `package.json` y `package-lock.json` sin cambios.
- Contraste calculado desde los tokens: texto 12.26:1, hover 10.84:1, enlace de salto 5.19:1, indicador y anillo de foco 5.19:1 y 4.59:1 (mínimo 3:1). El borde inferior del encabezado (1.22:1) es decorativo.
- Prueba manual en el navegador contra el backend real, con GERENTE y EXTERNO:
  - el GERENTE ve "Inicio" y "Socios", el EXTERNO solo "Inicio", y el link activo se distingue;
  - "Cerrar sesión" lleva a `/login` y con F5 sigue ahí;
  - una ruta inexistente lleva a la ruta inicial del rol (con sesión) o a `/login` (sin sesión);
  - un `?redirect` inventado cae en la ruta inicial;
  - el enlace de salto aparece con Tab y mueve el foco al contenido;
  - a 400 px los links se acomodan sin desborde horizontal;
  - no hay avisos de `vue-router` en la consola.
- **No probado:** RECEPCION y SOCIO en el armazón, el logout cuando falla contra el servidor, lector de pantalla y la medición de contraste en el navegador (se calculó desde los tokens).

### Commits

- `928e934` `Frontend: armazón de la app, rutas por módulo y ruta comodín`

### Pendientes que siguen abiertos

1. **Pantallas del Módulo 1** (gestión de socios y membresías, carnet) sobre este armazón.
2. **Revisar el borde del botón secundario** (~1.2:1) cuando una pantalla lo use.
3. **Distinguir una falla de red de una sesión vencida** al renovar.
4. **Pruebas automáticas con Vitest** (SCRUM-18).

---

## 2026-10-23 - Lista de socios con filtros y paginación (SCRUM-16)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Servicios.** `servicioSocios` (`listar` y `obtenerMembresia`) y `servicioSedes.listar` (pide páginas de 100 hasta traer todas), registrados en el contenedor de servicios y construidos en `main.ts`. Helper `mensajeDeError` en `errores.ts`.

2. **Composable `useListaSocios`.** Debounce de 300 ms en el nombre; cambiar un filtro vuelve a la página 1; cada consulta tiene un número y un `AbortController` para descartar las respuestas viejas; una página fuera de rango vuelve a la última con datos.

3. **Kit (`ui/`).** `SelectFz` (átomo), `TablaFz` (organismo genérico con `caption`, `scope` y región desplazable con foco) y `PaginacionFz` (molécula con `nav`, "Página X de Y" y `v-model`). Tokens de componente solo sobre semánticos.

4. **Features `sedes` y `socios`.** `useSedes` en `sedes`; en `socios`, `FiltrosSocios`, `TablaSocios`, `presentacion.ts` (ACTIVA verde, VENCIDA rojo, SUSPENDIDA ámbar, plan neutro; fecha `es-AR` en zona Buenos Aires) y `GestionSociosPage` con estados cargando, vacío y error, más un `aria-live` con la cantidad de resultados. Sin acciones por fila todavía.

5. **Borde del botón secundario.** Ahora apunta al token semántico del borde de los controles (3.41:1 en reposo, 3.02:1 en hover). Cierra el pendiente anotado en el LOG.

6. **`README.md`:** sección "Lista de socios" y la regla de dependencias entre features (una feature puede importar composables y tipos de otra, nunca sus páginas, componentes ni stores, y sin ciclos).

### Decisiones tomadas

1. **El contrato no trae plan ni estado en el listado de socios** (`SocioOut` y `ListaSocios` solo traen `id`, `usuarioId`, `sedeOrigenId`, `fechaAlta`, `nombre` y `email`), así que se pide la membresía de cada fila de la página (hasta 4 en paralelo, 10 filas por página). Si una falla, solo esa fila muestra "No disponible". Mejora propuesta: que el backend agregue plan y estado al listado.
2. **`TablaFz` va en `organismos/`** porque el README del kit lista "tabla" en ese nivel.
3. **`sedes` es una feature propia** porque la van a usar varios módulos.

### Problemas encontrados

1. **Ninguno.**

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- Sin `fetch` en `features/`, `router/`, `ui/` ni `app/`; `ui/` sin imports de `features/`, `compartido/` ni `app/`; colores literales solo en `primitivos.css`; sin variables sin definir; sin `localStorage`, `sessionStorage` ni cookies; `package.json` y `package-lock.json` sin cambios.
- Contraste de 20 pares medido con los tokens reales, sin ninguno por debajo del mínimo (insignias: neutra 10.84, ACTIVA 5.12, VENCIDA 4.52, SUSPENDIDA 4.74).
- Prueba manual en el navegador contra el backend real, con GERENTE y 3 socios en la base:
  - la tabla muestra nombre, email, sede por nombre, fecha, plan y estado con sus colores;
  - en Network salen 1 listado, 1 de sedes y 3 de membresías (más sus preflight);
  - con el backend apagado aparece el aviso rojo "No se pudo conectar con el servidor" y los filtros se conservan;
  - a 400 px los filtros se apilan y la tabla se desplaza dentro de su recuadro, sin desborde de la página.
- **No probado:** la paginación (hay solo 3 socios), el estado vacío, el debounce a ojo, lectores de pantalla, el foco de la paginación y el desplazamiento por teclado de la tabla. Los filtros por estado, plan, sede y nombre contra el backend tampoco se confirmaron con resultados.

### Commits

- `cbec5fb` `Frontend: lista de socios con filtros y paginación`

### Pendientes que siguen abiertos

1. **Detalle del socio y acciones** (suspender, cambiar plan, renovación automática, dejar de ser socio).
2. **Alta de socio.**
3. **Carnet del socio con QR.**
4. **Botón "Reintentar"** en el estado de error.
5. **Distinguir una falla de red de una sesión vencida** al renovar.
6. **Pruebas automáticas con Vitest** (SCRUM-18).

---

## 2026-10-23 - Detalle, alta y carnet de socio con QR (SCRUM-16)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Detalle del socio en `/socios/:socioId`.** Seis acciones (suspender, reactivar, cambiar plan, renovación automática, cambiar sede y dejar de ser socio), cada una con un `ModalFz` de confirmación (`<dialog>` nativo).

2. **Alta en `/socios/nuevo`, en dos pasos.** Primero se busca un usuario EXTERNO o se crea uno; después se elige la sede y el plan.

3. **Carnet en `/carnet` para SOCIO,** con `QrFz`, que genera el QR en el navegador.

4. **Pulido.** Menú, `README.md` y accesibilidad.

### Decisiones tomadas

1. **Dependencias nuevas:** `qrcode` 1.5.4 y `@types/qrcode` 1.5.6, con versiones exactas. El `package-lock.json` suma 30 paquetes, 28 de ellos transitivos.
2. **`registrarQr` se llama solo desde un botón confirmado,** porque sobrescribe el secreto. La URI y el secreto quedan únicamente en la memoria del componente.
3. **Si `crearUsuario` sale bien y `crearSocio` falla, el reintento no recrea el usuario:** el usuario creado pasa a ser el seleccionado.
4. **La ruta inicial del SOCIO pasa a `/carnet`.** El menú queda con "Inicio" en orden 0 y "Mi carnet" en orden 1.
5. **Nuevo composable `useUsuarioSesion` en `sesion`,** que expone `rol` y `socioId`, para que `socios` no importe el store de otra feature.
6. **Los 422 del backend vienen en inglés** (`class-validator`) y se muestran tal cual, asociados a su campo. El backend está cerrado.
7. **El secreto del QR se muestra para carga manual,** extraído del parámetro `secret` de la URI.

### Problemas encontrados

1. **Ninguno.**

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- 27 pares de contraste medidos, sin incumplimientos. Solo son informativos el borde del modal, el borde del QR y el borde del botón peligro.
- **No probado en ejecución:**
  - el render y el flujo de las pantallas nuevas;
  - el `<dialog>` (foco, Esc, `::backdrop`);
  - la generación real del QR y su vinculación con una app de autenticación;
  - los errores 402, 409 y 422 contra el backend real;
  - lectores de pantalla;
  - que el login cargue `socioId` en la sesión.

### Commits

- `b235036` `Frontend Pasos 11-14: detalle, alta y carnet de socio con QR`

### Pendientes que siguen abiertos

1. **Probar lo anterior con un socio de prueba** creado desde el alta.
2. **Borrar los usuarios de prueba** al final.

---

## 2026-10-23 - Prueba manual de los Pasos 11-14 y sedeId en la sesión (SCRUM-16)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Santino

### Actividades

1. **Prueba manual de los Pasos 11 a 14 contra el backend real.**
   - Detalle del socio: ficha, carnet y menú resaltado en `/socios`, `/socios/:id` y `/socios/nuevo`.
   - Suspender y reactivar con un socio real.
   - Alta de un socio de prueba, con el aviso de éxito mostrado una sola vez, y el intento de alta con el mismo email.
   - Login como ese socio: lo lleva a `/carnet`, el menú muestra "Inicio" y "Mi carnet", y el `socioId` llega en la sesión.
   - Generación del QR desde el modal de confirmación.
   - Teclado: foco visible, foco dentro del modal, y Esc cierra el modal y devuelve el foco.
   - Vista a 400 px: detalle, carnet, menú y modal.

2. **`sedeId` expuesto en `useUsuarioSesion`.** El login y el refresh ya traían el dato; solo faltaba exponerlo.

### Decisiones tomadas

1. **`sedeId` es `number | null`:** `null` para el GERENTE, que no tiene sede fija.

### Problemas encontrados

1. **Ninguno.**

### Verificación

- `npm run type-check` y `npm run build` tras el cambio de `sedeId`: **exit 0**.
- Prueba manual: ver Actividades.
- **Sigue sin probar:**
  - la vinculación del QR con una app de autenticación real;
  - los errores 402 y 422 contra el backend real;
  - lectores de pantalla;
  - la vista de RECEPCION en el menú;
  - las acciones de cambiar plan, renovación automática, cambiar sede y dejar de ser socio, ejecutadas de punta a punta.

### Commits

- `944a1d6` (`sedeId` expuesto en `useUsuarioSesion`)

### Pendientes que siguen abiertos

1. **Borrar los usuarios de prueba** al final, incluido "Prueba Alta".
2. **Los mensajes de validación del backend en inglés.**

---

## 2026-10-23 - Frontend M2: Gimnasio y Acceso (RF-04, RF-05, RNF-04, RNF-01)

**Fecha:** 23/10/2026 · **Rama:** `santiago` · **Autor:** Santiago Rayn

### Actividades

1. **Átomo `MedidorFz` en kit UI (`src/ui/atomos/MedidorFz.vue` y `src/ui/index.ts`):**
   - Implementado con etiqueta nativa `<meter>` y atributos de accesibilidad (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`).
   - Muestra siempre el texto legible "X de Y (Z%)" con soporte para rangos óptimo, advertencia y lleno.

2. **Composable compartido `useActualizacionPeriodica` (`src/compartido/composables/useActualizacionPeriodica.ts`):**
   - Permite ejecución periódica (por defecto cada 10s) con suspensión automática al ocultar la pestaña (`document.visibilityState === 'hidden'`) para evitar tráfico en segundo plano.

3. **Servicio y Composable de Sedes (`features/sedes`):**
   - Incorporación del método `crear(sede: SedeIn): Promise<SedeOut>` (`POST /sedes`) para RNF-04.
   - Creación del composable `useAltaSede` con validación de capacidad positiva y refresco automático.
   - Creación de componentes `FormularioSede.vue` y página `AltaSedePage.vue` en `/sedes/nueva` protegida para el rol GERENTE.

4. **Módulo de Acceso (`features/acceso`):**
   - **Servicio `servicioAcceso.ts`**: Métodos tipados contra `api.d.ts` para `obtenerAforo`, `registrarIngreso`, `registrarEgreso`, `listarIngresos`, `obtenerIngreso` y `sincronizarIngresos`.
   - **Composables**:
     - `useAforo`: Monitoreo en tiempo real con `useActualizacionPeriodica` y estado `estaLleno`.
     - `useRegistroIngreso`: Procesamiento de ingreso con código TOTP/QR y socio, traducción precisa de errores según `type` en RFC 9457 (membresía inactiva 403, acceso duplicado 409, aforo lleno 409, validación 422), y limpieza inmediata del código TOTP.
     - `usePersonasDentro`: Consulta de ingresos abiertos (`dentro=true`) y acción de egreso (`POST /ingresos/:id/egreso`), con auto-recarga ante colisiones 409 (egreso duplicado).
     - `useHistorialAccesos`: Filtros de fecha, sede y búsqueda de socio, paginación con `PaginacionFz`, debounce y cancelación de peticiones desactualizadas vía `AbortController`.
     - `useSincronizacionOffline`: Manejo de cola local en almacenamiento y envío en lote vía `POST /sincronizacion/ingresos` (RNF-01).
   - **Componentes y Páginas**:
     - `TarjetaAforo.vue`, `FormularioIngreso.vue`, `ResultadoIngreso.vue` (con alto contraste, íconos y textos no dependientes de color), `TablaPersonasDentro.vue`, `FiltrosHistorial.vue`, `TablaHistorial.vue`.
     - Páginas: `AforoPage.vue` (`/acceso/aforo`), `RegistrarIngresoPage.vue` (`/acceso/ingreso`) e `HistorialAccesosPage.vue` (`/acceso/historial`).
   - **Rutas y Navegación**:
     - Enrutamiento unificado con entrada en menú "Acceso" (orden 3) accesible para `RECEPCION` y `GERENTE`.
     - Selector dinámico de sede para `GERENTE` y sede fija del token para `RECEPCION`.

### Decisiones tomadas

1. **Diferenciación de errores RFC 9457**: Se utiliza el campo `type` de la respuesta `application/problem+json` para distinguir 409 de acceso duplicado (`acceso-duplicado`, RN-01) vs. 409 de capacidad colmada (`aforo-lleno`, RF-05).
2. **Seguridad del código TOTP**: El campo se vacía inmediatamente tras el envío y no se registra en memoria persistente ni logs.
3. **Pausado eficiente de peticiones**: Se detiene la llamada periódica de aforo al cambiar de vista o minimizar la pestaña de navegación.

### Verificación

- `npm run type-check` y `npm run build`: **exitoso (código 0)**.
- Integración en caliente con Vite en frontend (`http://localhost:5173/`).
- Documentación completa generada en `src/features/acceso/README.md`.



---

## 2026-10-23 - Frontend M3: Clases grupales (RF-06, RF-07, RF-08)

**Fecha:** 23/10/2026 · **Rama:** `main` · **Autor:** Gonzalo Vila

### Actividades

1. **Servicio de clases (`features/clases/services/servicioClases.ts`).** Clases, reservas de clase y esperas, tipado contra `api.d.ts` (`listarClases`, `obtenerClase`, `crearClase`, `listarReservasDeClase`, `crearReservaClase`, `listarReservasClase`, `cancelarReservaClase`, `anotarseEnEspera`, `listarEsperaDeClase`, `listarEsperasClase`, `salirDeEspera`, `confirmarEspera`). Registrado en `compartido/servicios.ts` (`clases`) y creado en `main.ts`; las rutas se suman en `router/index.ts`.

2. **Agenda en `/clases`** (SOCIO, RECEPCION, GERENTE).
   - `useAgendaClases`: filtros por disciplina (con debounce) y sede, página, cargando y error, descartando respuestas viejas con `AbortController`. RECEPCION arranca con su sede.
   - `FiltrosClases`, `TablaClases` (cupos libres e insignia de estado: con cupos, sin cupos, comenzada) y `AgendaClasesPage` con paginación, estado vacío y botón "+ Nueva clase" para RECEPCION y GERENTE.

3. **Detalle y reserva en `/clases/:claseId`.**
   - `useDetalleClase`: la clase, la reserva y la espera del socio, y las acciones reservar, cancelar, anotarse, confirmar cupo y salir. Después de cada acción vuelve a pedir la clase para tener los cupos del servidor.
   - `AccionesClase`: decide el botón (Reservar, Cancelar reserva, Anotarme en lista de espera, Confirmar cupo, Salir de la espera) o muestra el motivo ("La reserva se abre 48 hs antes", "La clase ya comenzó").
   - `ModalCancelarClase` (sobre `ModalFz`): con menos de 2 hs avisa "Se cobrará una penalidad del 50 % del valor de la clase".
   - `ListaInscriptos` y `ListaEsperaClase` para RECEPCION y GERENTE.

4. **Mis clases en `/mis-clases`** (SOCIO).
   - `useMisClases`: reservas confirmadas y canceladas, esperas con su posición en la cola y actualización cada 5 s.
   - `TablaMisReservas`, `TablaMisEsperas` y pestañas Próximas / Pasadas con el nuevo `PestanasFz`.

5. **Lista de espera (RF-08).** Anotarse, ver la posición, confirmar el cupo cuando el estado pasa a `NOTIFICADO` y salir. El detalle y "Mis clases" se refrescan con `useActualizacionPeriodica` y el intervalo se corta al salir.

6. **Alta de clase en `/clases/nueva`** (RECEPCION, GERENTE). `useAltaClase` valida que el fin sea posterior al inicio y que la capacidad sea un entero mayor a cero, arma los horarios ISO con offset `-03:00` y muestra el 409 de horario junto a los campos de horario. `FormularioClase` y `AltaClasePage`.

7. **Kit de diseño.** Componente nuevo `PestanasFz` (`ui/moleculas`, exportado en `ui/index.ts`): `role="tablist"`, `tab` y `tabpanel`, flechas, Inicio y Fin. `CampoTextoFz` acepta además `tipo="time"`.

8. **Rutas y menú.** `features/clases/rutas.ts` con `meta.roles`; entrada "Clases" (orden 4) para todos los roles y "Mis clases" (orden 5) para SOCIO.

9. **Documentación.** `features/clases/README.md` con carpetas, rutas y decisiones.

### Decisiones tomadas

1. **El servidor decide.** `reglas.ts` solo anticipa el motivo en pantalla (ventana de 48 hs, clase comenzada, penalidad). Si el servidor responde 409 por ventana se muestra el mismo motivo.
2. **Errores por el campo `type` del `problem+json`** (`errores.ts`), no por el texto: `reserva-anticipada-no-permitida`, `clase-pasada`, `cupo-agotado`, `reserva-duplicada`, `cupo-disponible`, `espera-existente`, `espera-confirmada`, `espera-no-notificada` y `cupo-tomado`. El 403 es cuota vencida (RN-03) y el 402 es penalidad rechazada.
3. **`PestanasFz` usa tokens semánticos existentes,** sin tokens nuevos. Queda pendiente la revisión de Santino en el PR y M4 puede reutilizarlo.
4. **Cambio mínimo en el kit:** `tipo="time"` en `CampoTextoFz`, necesario para las horas del alta.
5. **La agenda no filtra por fecha:** `GET /clases` no lo permite. Se muestra el listado paginado del servidor y no se recorta "la semana" en el cliente, porque rompería la paginación.
6. **La disciplina es texto libre:** `tipo` es un string libre en el contrato, así que el filtro es un campo de búsqueda.
7. **Inscriptos y espera muestran "Socio #id":** `ReservaClaseOut` y `EsperaOut` no traen el nombre.
8. **"Cumplida" tal cual lo manda el servidor.** "Pasadas" son las reservas que no están `CONFIRMADA` (cumplidas y canceladas).
9. **Sin tests y sin dependencias nuevas,** a pedido del equipo.

### Problemas encontrados

1. **`PATCH /socios/{id}/membresias` con `estado: VENCIDA` responde 422.** La membresía vencida de la prueba se forzó directo en la base.
2. **`POST /clases` con un horario ya iniciado responde 409 `clase-pasada`.** No se pudo crear una clase en curso para probar "la clase ya comenzó" desde la API.
3. **La limpieza de datos de prueba falló dos veces por claves foráneas** (pagos de membresía y de penalidad). Se resolvió borrando los pagos antes que los usuarios.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- Prueba manual del contrato contra el backend real (Supabase), con una sede, un gerente y tres socios de prueba:
  - reserva correcta: 201;
  - fuera de la ventana de 48 hs: 409 `reserva-anticipada-no-permitida`;
  - cupo completo: 409 `cupo-agotado`;
  - socio con cuotas vencidas: 403 `socio-en-mora`, tanto en reserva como en espera;
  - cancelación con más de 2 hs: 204;
  - cancelación con menos de 2 hs: 204 con penalidad;
  - cancelar una reserva ya cancelada: 204;
  - espera: anotarse 201, con cupo disponible 409 `cupo-disponible`, ya anotado 409 `espera-existente`;
  - al liberarse el cupo la espera pasa a `NOTIFICADO`, confirmar sin notificación da 409 `espera-no-notificada` y con notificación da 201;
  - salir de una espera confirmada: 409 `espera-confirmada`;
  - alta de clase 201 y clase en el pasado 409 `clase-pasada`;
  - listados con `perPage=100` en reservas, esperas e inscriptos.
- Los datos de prueba (sede, usuarios, socios, membresías, clases, reservas, esperas y pagos) se borraron al terminar.
- **No probado en ejecución:**
  - el recorrido visual en el navegador de las cuatro pantallas;
  - el modal de cancelación (foco, Esc);
  - las pestañas con teclado;
  - el aviso de 402 (la pasarela de la penalidad no rechazó ningún pago);
  - la vista de RECEPCION y de GERENTE;
  - lectores de pantalla y contraste.

### Commits

- `95d4935` `Frontend M3: clases grupales (agenda, reserva, mis clases, espera y alta de clase)`

### Pendientes que siguen abiertos

1. **Revisión de Santino** de `PestanasFz` y del cambio en `CampoTextoFz`.
2. **Recorrido visual** de las pantallas con un socio, un RECEPCION y un GERENTE.
3. **Tests de los composables con Vitest,** cuando el proyecto lo configure.
4. **Nombres de socio en inscriptos y espera,** si el contrato los incorpora.

---

## 2026-10-23 - Frontend M4/M5: `usuarioId` en la sesión y Vitest

**Fecha:** 23/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Actividades

1. **Backend (cambio autorizado):** `LoginOut` agrega `usuarioId` (DTO con `@ApiProperty` y `AuthService.emitirAccessToken()` con `usuario.id`), así login y refresh lo devuelven. `auth.service.spec.ts` lo verifica.
2. **Contrato:** `docs/openapi.yaml` declara `LoginOut.usuarioId` como requerido; `npm run types:api` regenera `src/types/api.d.ts`.
3. **Sesión del front:** `UsuarioSesion` y `usuarioDesdeSesion` guardan `usuarioId`; `useUsuarioSesion` lo expone como `usuarioId`.
4. **Vitest:** se instalan `vitest`, `@vue/test-utils` y `jsdom`; `vitest.config.ts` reutiliza la configuración de Vite (jsdom, `src/**/*.spec.ts`, `restoreMocks`) y se agregan los scripts `test` y `test:watch`. Un primer spec cubre `usuarioDesdeSesion`.

### Decisiones tomadas

1. **`usuarioId` en la sesión:** `POST/GET /reservas-canchas` lo exigen y `LoginOut` solo traía `socioId`/`sedeId`. Se agregó al contrato y al backend (autorizado) en vez de resolverlo con un request extra a `GET /socios/{socioId}` o decodificando el JWT.
2. **Vitest instalado:** M3 lo había dejado pendiente "cuando el proyecto lo configure"; M4/M5 lo necesitan para los tests de composables. Es una dependencia nueva y queda anotada para la revisión del PR.

### Verificación

- Backend: `npx tsc --noEmit` 0; `npm run test:unit` **285/285** (incluye `auth.service.spec.ts` con `usuarioId: 7`).
- Frontend: `npm run type-check` 0; `npm run build` 0; `npm run test` **2/2**.
- Smoke contra el backend real: `GET /api/v1/sedes` 200; `GET /api/v1/sedes/1/canchas` 200 (canchas con `costoPorHora` y `estado`).
- **No probado en ejecución:** respuesta de `POST /auth/login` con una sesión real (se cubrió con el unit test de `AuthService`).

### Pendientes que siguen abiertos

1. Revisión de Santino del cambio en `LoginOut`/contrato y de la dependencia de Vitest.

---

## 2026-10-23 - Frontend M4: canchas, grilla y reservas

**Fecha:** 23/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Actividades

1. **Servicio `servicioCanchas`** (listar, crear, obtener, modificar, disponibilidad, crear/listar/obtener/cancelar reserva), tipado contra `api.d.ts`; registrado en `compartido/servicios.ts` y `main.ts`.
2. **`/canchas`:** lista de canchas por sede con filtro de estado y paginación; RECEPCION arranca en su sede y el GERENTE ve el acceso a la gestión.
3. **`/canchas/:canchaId/turnos`:** fecha (`YYYY-MM-DD`), cancha con estado y precio, y grilla donde cada tramo es un botón con rango y estado en texto (libre / ocupado / no disponible por mantenimiento).
4. **Reserva:** `ConfirmarReserva` (`ModalFz`) muestra el precio base; ante un 409 por `turno-ocupado` avisa "Ese turno acaba de ser tomado, elegí otro" y recarga la grilla.
5. **`/mis-reservas`:** pestañas Próximas / Canceladas / Pasadas con `PestanasFz`, cancelación con confirmación y botón "Pagar" cuando no hay un pago aprobado.
6. **`/canchas/gestion` (GERENTE):** alta con deporte y costo por hora, edición del costo y pasar/liberar mantenimiento.
7. `errores.ts` (409 por `type`), `presentacion.ts` (etiquetas, montos y fechas de la sede), `rutas.ts` y `README.md` del feature.

### Decisiones tomadas

1. **Precio:** `DisponibilidadEntrada` no trae precio, así que el modal muestra `costoPorHora` como precio base y el `precioAplicado` del 201 es el definitivo. El front no calcula ni estima.
2. **409 por `type`:** `turno-ocupado` y `cancha-en-mantenimiento` al reservar; `reserva-ya-cancelada` y `reserva-pasada` al cancelar. Sin errores genéricos.
3. **Mantenimiento:** la cancha `EN_MANTENIMIENTO` deshabilita todos los tramos con su propio texto, distinto de "ocupado".
4. **"Mis reservas":** el estado de pago se resuelve con `listarPagos({ reservaCanchaId })` por fila (default APROBADO) y concurrencia 4; con pago aprobado se muestra la insignia "Pagada".
5. **Limitaciones del contrato:** `ReservaCanchaOut` no trae la cancha (se muestra "Cancha #id") y la disponibilidad no trae precio.

### Problemas encontrados

1. **`ReservaCanchaOut` no incluye la cancha:** "Mis reservas" muestra "Cancha #id" en lugar del deporte.
2. **`GET /reservas-canchas` sin `usuarioId` devuelve todas:** "Mis reservas" siempre manda el `usuarioId` de la sesión.
3. **`ConsultarDisponibilidadQueryDto` pagina con `perPage` máximo 100:** la grilla pide `perPage=100` para traer el día completo.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- `npm run test`: **green** (los specs de M4/M5 suman 13 casos).
- Smoke contra el backend real: `GET /api/v1/sedes/1/canchas` 200; `GET /api/v1/canchas/1/disponibilidad?fecha=2026-10-24` 200 (tramos con `disponible`); `GET /api/v1/reservas-canchas?usuarioId=1` 200.
- **No probado en ejecución:** recorrido visual con sesión, dos pestañas sobre el mismo turno, cancha en mantenimiento y cancelación.

### Pendientes que siguen abiertos

1. Prueba manual con SOCIO, RECEPCION y GERENTE reales.
2. Revisión de Santino del PR.

---

## 2026-10-23 - Frontend M5: pago, comprobante, anulación y reporte

**Fecha:** 23/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Actividades

1. **Servicio `servicioPagos`:** `procesar` (con `Idempotency-Key`), `listar`, `obtener`, `anular`, `descargarComprobante` y `descargarReporte` (`parseAs: 'blob'`).
2. **`/pagos/nuevo?reservaId=`:** resumen de la reserva y el monto, `SelectFz` de medio simulado (aprobada/rechazada), resultado y descarga del comprobante.
3. **`/pagos` (RECEPCION, GERENTE):** filtros por estado, concepto y período, lista paginada, descarga del comprobante y anulación con confirmación.
4. **`/reportes/ingresos` (GERENTE):** desde/hasta, aviso de que sin fechas es todo el histórico y descarga del PDF.
5. **Composables:** `usePagarReserva`, `useListaPagos`, `useAnularPago`, `useDescargaPdf` y `useReporteIngresos`; `README.md` del feature.

### Decisiones tomadas

1. **Idempotencia:** `crypto.randomUUID()` por intento; un reintento por corte de red conserva la clave (no se sabe si cobró) y después de un 402 se genera una nueva.
2. **409:** sea `idempotencia-repetida` o "reserva ya cobrada", se consulta `listarPagos({ reservaCanchaId })` y se muestra el pago real, no un error.
3. **402:** "El pago fue rechazado"; la reserva sigue confirmada y se puede reintentar con otra clave.
4. **Token de pago:** el select usa valores opacos (`aprobada`/`rechazada`) y el composable los traduce a `tok_aprobado_demo`/`tok_rechazado_demo`. El token nunca se muestra, guarda ni loguea.
5. **PDF:** comprobante y reporte se bajan como Blob con el cliente autenticado y se ofrecen con una URL temporal que se libera; un enlace directo no autentica porque el token vive en memoria.
6. **Errores de los PDF:** con `parseAs: 'blob'` el error también llega como Blob, así que `desenvolverPdf` lee el `problem+json` antes de armar el `ErrorApi`.
7. **Lista de pagos:** sin estado el contrato devuelve solo aprobados; la columna "Concepto" muestra el tipo genérico (también aparecen penalidades de clase).

### Problemas encontrados

1. **`parseAs: 'blob'` degrada el mensaje de error:** se resolvió leyendo el Blob como texto y parseando el `problem+json`.
2. **`comprobantePdfUrl` no se usa:** el contrato lo expone, pero el PDF se pide al endpoint autenticado.

### Verificación

- `npm run type-check` y `npm run build`: **exit 0**.
- `npm run test`: **13/13** en 5 archivos (pago con misma/nueva clave, 409 con pago real, lista de pagos y descarga de PDF).
- Smoke contra el backend real: `GET /api/v1/pagos` 200 (pagos aprobados); `GET /api/v1/reportes/pagos` **401 sin token** (protegido para GERENTE).
- **No probado en ejecución:** pago aprobado y rechazado, reintento con la misma clave, comprobante y reporte con una sesión real.

### Pendientes que siguen abiertos

1. Prueba manual del flujo completo con sesión (login → reservar → pagar → comprobante → anular → reporte).
2. Revisión de Santino del PR.

---

## 2026-10-23 - Fix: el EXTERNO reserva y ve sus reservas

**Fecha:** 23/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Problema

Un usuario con rol `EXTERNO` entraba y no podía reservar una cancha ni ver sus reservas: los `meta.roles` de M4/M5 solo incluían `SOCIO`, `RECEPCION` y `GERENTE`, así que el guard del router lo redirigía a `/inicio`. El backend no tiene guards en M4/M5 y `LoginOut.usuarioId` ya está en la sesión, por lo que la API sí acepta al EXTERNO.

### Actividades

1. `features/canchas/rutas.ts`: `EXTERNO` agregado a `/canchas`, `/canchas/:canchaId/turnos` y `/mis-reservas`.
2. `features/pagos/rutas.ts`: `EXTERNO` agregado a `/pagos/nuevo` (`pagar-reserva`). `/pagos` y `/reportes/ingresos` siguen para RECEPCION/GERENTE y GERENTE.
3. `features/sesion/acceso.ts`: `rutaInicialPorRol('EXTERNO')` devuelve `/canchas` (antes caía en `/inicio`, que es un placeholder).
4. READMEs de `canchas` y `pagos` actualizados; tests de regresión `rutas.spec.ts` en cada feature.

### Decisiones tomadas

1. **El EXTERNO reserva y paga:** el doc de M4/M5 se contradice (la tabla de pantallas excluye `EXTERNO`, pero el alcance dice "todos los roles con sesión"); se sigue el alcance y el pedido del equipo. El EXTERNO no tiene `socioId`, pero sí `usuarioId`, y el servidor lo cotiza como externo.
2. **La lista de pagos y el reporte no se abren al EXTERNO:** siguen siendo del staff.

### Verificación

- `npm run type-check` 0; `npm run build` 0; `npm run test` **17/17** (se suman los dos `rutas.spec.ts`).
- **No probado en ejecución:** login real con un EXTERNO.

### Pendientes que siguen abiertos

1. Prueba manual con un EXTERNO real (reservar, ver "Mis reservas" y pagar).
2. Revisión de Santino del PR.

---

## 2026-10-23 - Correcciones de la prueba manual (M4)

**Fecha:** 23/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Actividades

1. **Pagar una reserva cumplida:** `TablaReservas` solo ofrecía "Pagar" en `CONFIRMADA`, así que al terminar el turno (estado derivado `CUMPLIDA`) desaparecía. Ahora se ofrece en `CONFIRMADA` y `CUMPLIDA` impagas (`puedePagarse`), y "Cancelar" solo si el turno no empezó.
2. **Mantenimiento (A):** pasar una cancha a `EN_MANTENIMIENTO` conserva las reservas existentes. `useGrillaTurnos` carga las reservas del día (`CONFIRMADA` + `CUMPLIDA`) y `estadoDeTurno` muestra esos tramos como "ocupado" y el resto como "no disponible por mantenimiento" (antes los tapaba a todos).
3. **Turnos pasados:** `DisponibilidadService` marca `inicio <= ahora` como `disponible: false`; se agrega la validación `TurnoNoPasado` a la cadena de reservas (422 `Turno pasado`, `about:blank`); la grilla muestra "ya pasó" y el selector de fecha arranca en hoy.
4. **Turno en curso (bucle del modal):** `puedeCancelarse` usa el **inicio** (el backend deriva `CUMPLIDA` recién al terminar), `situacionDeReserva` muestra "En curso", `MisReservasPage` cierra el modal siempre y deja el 409 como aviso en la página. Se agregan un reloj local de 30 s y un refresco de 60 s.

### Decisiones tomadas

1. **Mantenimiento (A):** se conservan las reservas ya tomadas y la grilla las sigue mostrando como ocupadas; solo se bloquean las nuevas (409 `cancha-en-mantenimiento`). Esto mantiene la lectura de RF-12 del doc ("no toca las reservas ya tomadas") y evita cancelar turnos que el socio ya tenía.
2. **Turno pasado = 422 `about:blank`:** reusa el 422 que el contrato ya declara, sin agregar un `type` nuevo al contrato.
3. **"En curso" es derivado en el front:** el contrato solo tiene `CONFIRMADA`/`CANCELADA`/`CUMPLIDA`; el estado "en curso" se calcula con las fechas.

### Verificación

- Backend: `npx tsc --noEmit` 0; `npm run test:unit` **286/286** (nuevo caso `TurnoNoPasado`).
- Frontend: `npm run type-check` 0; `npm run build` 0; `npm run test` **23/23** (8 archivos).
- Backend real (tras reiniciar, el `--watch` no había tomado los cambios):
  - `GET /canchas/1/disponibilidad?fecha=2026-10-23`: los tramos de 08:00 a 20:00 (ya pasados) responden `disponible: false`; 21:00-22:00 `true`.
  - `POST /reservas-canchas` con 08:00-09:00 de hoy: **422** `Turno pasado` ("No se puede reservar un turno que ya comenzó").
- **No probado en ejecución:** las pantallas con sesión (pagar una cumplida, ver una cancha en mantenimiento con reservas, "En curso" y cancelación sin bucle).

### Pendientes que siguen abiertos

1. Prueba manual en el navegador de los cuatro casos.
2. Revisión de Santino del PR.
3. **B (backend):** permitir reintentar el cobro de una reserva tras un 402 o una anulación (hoy el `@unique` de `PagoReserva.reserva_id` lo bloquea).

---

## 2026-10-23 - M3: comprobante de la penalidad por cancelación tardía (RF-07)

**Fecha:** 23/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Problema

Al cancelar una reserva de clase con menos de 2 hs, el backend cobraba la penalidad (RF-07) y generaba el comprobante, pero el front solo mostraba "Reserva cancelada.": el socio no veía el importe ni tenía forma de descargar el PDF (la lista `/pagos` es de RECEPCION/GERENTE).

### Actividades

1. `useDetalleClase` y `useMisClases`: después del 204, `GET /pagos?reservaClaseId=<id>`; si hay pago, `pagoPenalidad` y el mensaje con el importe (`formatearMonto`).
2. `descargarComprobantePenalidad()` reusa `useDescargaPdf` de M5 + `GET /pagos/{pagoId}/comprobante`.
3. `DetalleClasePage` y `MisClasesPage`: botón "Descargar comprobante" cuando hay `pagoPenalidad` y aviso del error de descarga.
4. `presentacion.ts` de M3: `formatearMonto` (`Intl.NumberFormat` es-AR/ARS).
5. Spec `useMisClases.spec.ts` (con penalidad y sin penalidad).

### Decisiones tomadas

1. **Sin cambios de backend:** el pago y el comprobante ya se generaban en `CobroInternoService`; el front los busca por `reservaClaseId`, que ya está en el contrato de `listarPagos`. No se cambia el 204 de la cancelación.
2. **El comprobante lo baja el socio:** se reusa `useDescargaPdf` (M5) en vez de duplicar el manejo de Blob/URL temporal.

### Verificación

- `npm run type-check` 0; `npm run test` **25/25** (9 archivos); `npm run build` 0.
- **No probado en ejecución:** la cancelación tardía en el navegador (importe + descarga del PDF).

### Pendientes que siguen abiertos

1. Prueba manual: cancelar una clase a menos de 2 hs y descargar el comprobante.
2. Avisar a Gonzalo (M3) y revisión de Santino del PR.

---

## 2026-10-23 - M3: no volver a reservar en la misma pantalla tras cancelar

**Fecha:** 23/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Problema

Después de cancelar una clase, el detalle recargaba y `AccionesClase` volvía a mostrar "Reservar" (el cupo quedaba libre y el backend lo permite). El pedido es que en esa pantalla solo quede "Volver a la agenda" y que reservar de nuevo requiera rehacer el recorrido.

### Actividades

1. `useDetalleClase`: `reservaCancelada` (se pone en `true` al cancelar; se resetea al cambiar de clase con `watch(claseId)`).
2. `DetalleClasePage`: oculta `AccionesClase` cuando `reservaCancelada` y muestra "Volver a la agenda" (`/clases`); el "Descargar comprobante" de la penalidad sigue visible.
3. Spec `useDetalleClase.spec.ts` (el flag y el reset).

### Decisiones tomadas

1. **Solo UX, sin backend:** la API sigue permitiendo reservar; lo que cambia es que la pantalla no lo ofrece inmediatamente.
2. **"Volver" a la agenda** (`/clases`), como pidió el equipo, en vez de `router.back()`.

### Verificación

- `npm run type-check` 0; `npm run test` **26/26** (10 archivos); `npm run build` 0.
- **No probado en ejecución:** el recorrido en el navegador.

### Pendientes que siguen abiertos

1. Prueba manual: cancelar → solo "Volver a la agenda" → rehacer el recorrido para reservar.
2. Avisar a Gonzalo (M3) y revisión de Santino del PR.

---

## 2026-10-24 - M4/M5: cancelar una reserva de cancha pagada anula el pago

**Fecha:** 24/10/2026 · **Rama:** `feat/m4-m5-canchas-pagos` · **Autor:** Exequiel Ansaldi

### Problema

Al cancelar una reserva de cancha que ya estaba pagada, el `Pago` quedaba APROBADO y no se devolvía el dinero. La anulación existía solo como acción manual (`POST /pagos/{id}/anulaciones`).

### Actividades

1. `commons/eventos.ts`: `EVENTO_RESERVA_CANCHA_CANCELADA = 'reservaCancha.cancelada'`.
2. `ReservasCanchasService.cancelar` (M4): inyecta `EventEmitter2` y emite el evento después del commit, con `reservaId` y `usuarioId`.
3. `PagoRepository.buscarPorReservaCancha(reservaId)`: encuentra el pago (cualquier estado) por la relación `pago_reserva`.
4. `ReservaCanceladaListener` (M5): si el pago está APROBADO, llama a `PagosService.anularPago` (ANULADO + reembolso). `suppressErrors: false`: si el reembolso falla, el error sube.
5. `PagosModule`: registra el listener.
6. Tests: unit del listener (APROBADO/otros estados/sin pago/error) e integración M4→M5 contra la BD real. El módulo de integración necesita `init()` para que el `@OnEvent` quede suscrito.

### Decisiones tomadas

1. **Evento, no import:** M4 no puede depender de M5 (el grafo es M5 → M4); se reusa el patrón Observer de RF-02/RF-07.
2. **Anulación idempotente:** PENDIENTE/RECHAZADO/ANULADO no se tocan (PENDIENTE no se cobró; RECHAZADO no es anulable).
3. **Re-pago tras la anulación:** queda para la reunión (B4): `PagoReserva.reserva_id` es `@unique` y bloquea un segundo cobro.

### Verificación

- `npx tsc --noEmit` 0; `npm run test:unit` **292/292** (41 archivos); `npm run test:integration` **54/54** (11 archivos).
- Smoke HTTP contra el backend (`:3000`, Supabase): login EXTERNO → reservar → pagar (`tok_aprobado_demo`) → cancelar (204) → el pago pasa a **ANULADO**. Los datos del smoke se borraron.
- **No probado en ejecución:** el recorrido en el navegador.

### Pendientes que siguen abiertos

1. Prueba manual: reservar → pagar → cancelar → ver el pago ANULADO en `/pagos` (filtro ANULADO).
2. **QR dinámico (M1/M2):** `POST /auth/totp` sin secreto en la respuesta (provisiona si falta y devuelve solo `{codigo, expiraEn}`); carnet con solo el QR `FZ:<socioId>:<codigo>` refrescado cada 30 s; escáner en `/acceso/ingreso` con `vue-qrcode-reader` y auto-validación (fallback manual).
3. **B4 (backend):** reintento de cobro tras 402/anulación con historial de intentos (migración: `PagoReserva.reserva_id` deja de ser único, con `revocado`/unique parcial) + front de reintentos y cancelar.
4. Default de `/pagos`: definir en la reunión.

---

## 2026-10-24 - Frontend: reestilización visual, Paso 1 (tokens de diseño)

**Fecha:** 24/10/2026 · **Rama:** `main` · **Autor:** Santino Mazzulla (P3 Frontend) · **Commit:** `3c7fa76`

### Actividades

1. **Paleta:** se reemplazó la de Santiago por la del prototipo "SportOS" (estilo Notion), ajustada para WCAG 2.2 AA. Fondo `#FFFFFF`, superficie `#FBFBFA`, hover `#F1F1EF`; texto `#37352F` y secundario `#73726e` (contraste AA); borde de controles `#8c8b87` (3:1); acento azul `#1a6ec1` (hover `#165ca0`); estados verde `#287447`, rojo `#c53b32` y ámbar `#9a610f`.
2. **Capa semántica:** mapeo actualizado (fondo, superficie, hover, texto sobre primario, foco), sin hex ni rgba literales.
3. **Tipografía y formas:** escala ajustada (título 1.5rem), fuente Inter con fallbacks de sistema y radios 4/8/12/completo.
4. **Modo oscuro eliminado:** se borró `useModoOscuro.ts` y se quitó su uso y el botón de tema en `ArmazonApp.vue`.

### Decisiones tomadas

1. **Sin modo oscuro:** no está en el contrato ni en el dominio, y el prototipo no lo tiene.
2. **Variables inventadas sin tocar:** las `--fz-*` con valor de respaldo en `acceso` y `sedes` se corrigen módulo por módulo, no en este paso.

### Verificación

- `npm run type-check`, `npm run build` y `npm run test` en verde (**26/26** tests).
- Tabla de contrastes revisada con un script sobre los valores reales de los tokens: todo OK.
- Quedan solo las variables no definidas ya conocidas (tokens inventados en `acceso` y `sedes`).
- Revisión visual manual con sesión de GERENTE en `/socios`: la paleta nueva se ve coherente (pills de estado y plan, bordes de filtros, botón primario y menú activo legibles). La estructura de la pantalla (barra superior, botón Exportar CSV, menú "···", placeholder con DNI) sigue siendo la anterior y se rehace en los pasos de M1.

### Pendientes que siguen abiertos

1. **Paso 2:** el armazón de la app (barra lateral, barra superior, iconos SVG propios, toasts y menú desplegable).
2. Reemplazar las variables `--fz-*` inventadas de `acceso` y `sedes` al pasar cada módulo al estilo nuevo.

---

## 2026-10-24 - Frontend: reestilización visual, Paso 2a (armazón de la app)

**Fecha:** 24/10/2026 · **Rama:** `main` · **Autor:** Santino Mazzulla (P3 Frontend) · **Commit:** `7655652`

### Actividades

1. **Armazón nuevo:** RECEPCION y GERENTE ven una barra lateral de 240 px con secciones (Operaciones, Clases y deporte, Administración) y bloque de usuario abajo; SOCIO y EXTERNO, una barra superior. En celular la barra lateral pasa a una barra superior con botón "Menú" (desplegable con `aria-expanded`, se cierra con Escape y al navegar).
2. **Kit:** `PlantillaAppFz` suma, de forma aditiva, la prop `disposicion` (`'barra-superior'` por defecto o `'barra-lateral'`), el slot `pie` y las props de texto del menú. Nuevo átomo `IconoFz` con íconos SVG propios (carnet, socios, acceso, clases, canchas, pagos, reportes, cerrar-sesion, menu, cerrar).
3. **Navegación:** `meta.navegacion` de las rutas suma los campos opcionales `icono` y `seccion` (completados en socios, acceso, clases, canchas y pagos). `/inicio` sale del menú; la ruta queda como respaldo de los roles desconocidos.
4. **Sesión:** nuevo composable `usePerfilSesion` (nombre y email vía `GET /usuarios/{id}`; nombre de la sede de RECEPCION vía `sedes.listar` filtrando por `sedeId`) con aborto y sin avisos si falla, y `presentacion.ts` con `etiquetaRol`.
5. **Tokens:** nuevo primitivo `gris-150` (`#ECECE9`) y semántico `seleccionado`; tokens del armazón en `componentes.css`; `texto-minimo` (0.75rem). El gris de texto suave pasa de `#73726e` a `#6b6a66` para llegar a 4.5:1 sobre hover y seleccionado.

### Decisiones tomadas

1. **Sin selector de sede activa:** el contrato no tiene sede activa global. La sede de RECEPCION se muestra como texto.
2. **Sede desde el listado:** sale de `sedes.listar()` porque no existe `GET /sedes/{id}`; si el backend lo suma, conviene cambiarlo.
3. **Inicio fuera del menú:** la página está vacía; queda la ruta y se puede usar luego como dashboard.
4. **Íconos compartidos a propósito:** canchas con mis-reservas y clases con mis-clases.
5. **Cerrar sesión sin `BotonFz`:** el botón es propio por el hover en rojo de estado (4.59:1 sobre hover).

### Verificación

- `npm run type-check`, `npm run build` y `npm run test` en verde: **42 tests** en 13 archivos (eran 26 antes del Paso 1 y 37 antes de este ajuste).
- Contrastes de todos los pares nuevos y existentes: cero fallas (el margen más justo es 4.52:1).
- Revisión visual manual con sesión real de GERENTE, RECEPCION, SOCIO y EXTERNO y del menú en ancho de celular: el armazón se ve y se comporta como se esperaba.
- **Pendiente de ver en pantalla:** el nombre de la sede de RECEPCION, porque el usuario de prueba todavía no tiene fila en `EmpleadoSede`. Está cubierto por tests de `usePerfilSesion`.
- **Hallazgo de backend:** `GET /usuarios` y `GET /usuarios/{id}` no tienen guard ni `security` en el contrato y devuelven DNI, email y teléfono a cualquiera, incluso sin sesión. Pendiente de corregir en el backend.

### Pendientes que siguen abiertos

1. **Paso de densidad:** acercar los tamaños de texto, los altos de controles y los espaciados al prototipo, sin bajar de los 24 px de objetivo táctil (WCAG 2.2 AA). Incluye el ajuste fino del armazón: espaciado de la barra lateral, posición del botón de cerrar sesión y `title` en nombre y email truncados.
2. **Paso 2b:** toasts y menú desplegable con Reka UI dentro de `ui/` (falta el ADR y aprobar la dependencia).
3. Proteger con guards y `security` en el contrato los endpoints de usuarios (y revisar socios y membresías).
4. Probar RECEPCION con sede real (fila en `EmpleadoSede`).
5. Reemplazar las variables `--fz-*` inventadas de `acceso` y `sedes` al pasar cada módulo al estilo nuevo.
6. Datos de prueba en la base compartida a limpiar al final: los usuarios de prueba creados para la revisión (incluido un RECEPCION).

---

## 2026-10-24 - Frontend: reestilización visual, paso de densidad (escala compacta)

**Fecha:** 24/10/2026 · **Rama:** `main` · **Autor:** Santino Mazzulla (P3 Frontend) · **Commit:** `19e1fdb`

### Actividades

1. **Escala de texto compacta, solo con tokens:** nuevo primitivo `--fz-prim-texto-13` (0.8125rem). `texto-pequeno` pasa de 14 a 13 px (texto de la interfaz), `texto-cuerpo` de 16 a 14 px y `texto-titulo` de 24 a 20 px. `texto-minimo` queda en 12 px como piso.
2. **Controles más bajos:** botón, campo de texto y select pasan a 28 / 32 / 36 px (`sm` / `md` / `lg`; antes 32 / 40 / 48). Texto de los controles: `sm` 12 px, `md` 13 px, `lg` 14 px.
3. **Insignia, tabla, pestañas y medidor:** insignia con texto de 12 px y algo más de relleno vertical; celdas de tabla con 0.625rem arriba y abajo; pestañas y medidor pasan a `texto-pequeno`.
4. **Ajuste fino del armazón:** links de la barra lateral de 28 px de alto mínimo, menos separación vertical entre links y 1rem entre secciones; el botón de cerrar sesión pasa a la misma fila que los datos del usuario; `title` con el texto completo en nombre y email truncados.
5. **Documentación:** `ui/README.md` documenta la escala de tamaños y dos reglas: ningún texto legible por debajo de 12 px y ningún control por debajo de 24 px de alto (WCAG 2.2 AA, 2.5.8).

### Decisiones tomadas

1. **Primitivo por valor:** el nuevo se llama `texto-13` porque la escala por talles no tiene lugar libre entre `xs` y `sm`.
2. **Piso de 12 px para todo texto:** no hay textos de 9 a 11 px, aunque el diseño de referencia los usa, porque se leen mal.
3. **Controles sobre el mínimo:** el más bajo (28 px) queda por encima de los 24 px mínimos de WCAG 2.2.
4. **Pantallas sin tocar:** los tamaños escritos a mano en cada módulo se pasan a tokens cuando se restilice ese módulo.

### Verificación

- `npm run type-check`, `npm run build` y `npm run test` en verde: **42 tests** en 13 archivos.
- Contrastes: sin cambios, todos los pares OK (el margen más justo es 4.52:1).
- Revisión visual manual con GERENTE (lista de socios) y EXTERNO (canchas): controles, tablas, insignias y armazón con la escala nueva.
- Los títulos y otros tamaños escritos a mano en las pantallas (por ejemplo 28 px en `acceso`, `canchas`, `clases`, `pagos` y `socios`) no heredan la escala y se ven más grandes hasta que cada módulo pase a tokens.

### Pendientes que siguen abiertos

1. **Paso 2b:** toasts y menú desplegable con Reka UI dentro de `ui/` (falta el ADR y aprobar la dependencia).
2. Restilizar M1 pantalla por pantalla y pasar a tokens los tamaños y colores escritos a mano de cada módulo, incluidas las variables `--fz-*` inventadas de `acceso` y `sedes`.
3. Proteger con guards y `security` en el contrato los endpoints de usuarios (y revisar socios y membresías).
4. Probar RECEPCION con sede real (fila en `EmpleadoSede`).
5. Datos de prueba en la base compartida a limpiar al final.
