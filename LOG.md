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