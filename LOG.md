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
   - El equipo usa Supabase free tier (2 proyectos gratis por organización, sin margen para duplicar la base de desarrollo). Se descartó un segundo proyecto Supabase y un schema separado dentro del mismo proyecto compartido, y se optó por un Postgres efímero en Docker (`docker-compose.test.yml`, puerto `55432`) exclusivo para los tests e2e, sin tocar la Supabase de desarrollo del equipo.
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