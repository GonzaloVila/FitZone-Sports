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
   - El motivo: quedan compilables bajo `strictPropertyInitialization` (el editor de TS 6 lo aplica aunque el tsconfig del proyecto no tenga `strict`); en runtime no cambia nada, el `ValidationPipe`/`plainToInstance` asigna los campos al validar. Sinefto: `npm run build` + `npx tsc --noEmit` en verde.
   - [commit 95629dc](https://github.com/GonzaloVila/FitZone-Sports/commit/95629dc)
