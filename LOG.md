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

### Semana 4 · SCRUM-11 — Inyección de dependencias y primera API REST (desglosada)

**Fecha:** 14–18/09/2026 · **Rama:** `exe` + PRs a `main` · **Prioridades:** P0 = micro 1–4 + L1 · P1 = L2–L4 + L6 · P2 = 5 + L5

#### Microtareas (a completar al cerrar cada una con su commit)

| # | Microtarea | Responsable | Estado | Commit |
|---|---|---|---|---|
| 1 | Bootstrap NestJS: `main.ts` (ValidationPipe global + prefijo `api/v1` + Swagger `/docs`) + `ConfigModule` (zod) | Exequiel | Finalizada | — |
| 2 | PrismaService singleton (`commons/database`, logs + ping Supabase) | Exequiel | Por hacer | — |
| 3 | Filtro global RFC 9457 (`commons/filters`) → `application/problem+json` | Santino | Por hacer | — |
| 4 | Repositorio puerto m1 + DI por constructor (referencia para M2–M4) | Exequiel | Por hacer | — |
| 5 | Mediador mínimo (`commons/mediador`) | Gonzalo | Por hacer | — |
| L1 | Usuarios: POST `201+Location` / GET `{id}` `404` / PATCH parcial | Exequiel | Por hacer | — |
| L2 | Sedes: GET listado paginado + POST alta (RNF-04) | Santino | Por hacer | — |
| L3 | Canchas: GET por sede (paginado) + POST alta (RF-09) | Santiago | Por hacer | — |
| L4 | Socio + Membresía: alta plan + GET membresía actual (1:1) | Exequiel | Por hacer | — |
| L5 | Aforo RF-05: GET `/sedes/{id}/aforo` | Santino | Por hacer | — |
| L6 | Reserva + RN-02: disponibilidad (RNF-03) + POST + test de concurrencia | Exequiel + Gonzalo | Por hacer | — |

#### Pendiente (cierre de la semana)

- Swagger completo documentando `problem+json` y paginación + test e2e (`supertest`) consolidado — Gonzalo con revisión del equipo.
- Consolidar el entregable C4 + ADR de la Semana 2 — Santiago.
- **Fuera de alcance** (próxima semana): Clases (RF-06), Pagos/M5 + comprobante PDF (RF-14) y auth (no hay login).

---

## Templates de integrantes (completar por cada uno)

### Unidad I — Arquitectura · Santiago Rayn (P1)

- _Actividades:_ ...

### Unidad IV — Componentes · Santino Mazzulla (P3)

- _Actividades:_ ...

### Unidades V–VI — Testing/DevOps/Mobile · Gonzalo Vila (P4)

- _Actividades:_ ...