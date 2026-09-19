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

---

## Templates de integrantes (completar por cada uno)

### Unidad I — Arquitectura · Santiago Rayn (P1)

- _Actividades:_ ...

### Unidad IV — Componentes · Santino Mazzulla (P3)

- _Actividades:_ ...

### Unidades V–VI — Testing/DevOps/Mobile · Gonzalo Vila (P4)

- _Actividades:_ ...