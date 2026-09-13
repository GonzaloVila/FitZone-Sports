# LOG — FitZone Sports

> Bitácora del equipo (vinculada a los commits del repositorio).
> Formato disenado en el plan (Plan y Organizacion §5.2): cada integrante documenta por unidad
> sus **actividades**, **decisiones** y **problemas encontrados**, enlazando el registro a los commits.

**Regla de unicidad por unidad:** cada bloque corresponde a una historia del Sprint (SCRUM-xx).
**Regla de commits:** toda actividad cierra con link al commit/s del repo en GitHub.

---

## Unidad II — Frameworks (25%) · Exequiel Ansaldi (P2 — Backend Developer)

### Semana 3 · SCRUM-10 — Scaffolding y estructura base del backend

**Fecha:** 07/09/2026 · **Rama:** `main`

#### Actividades realizadas

- Creé la **estructura base del backend** en `backend/` dentro del repo (decisión de monorepo): carpeta por capa para `commons/` (database, mediador, filters, guards) y `modules/` (M1–M4 en capas; M5-pagos hexagonal), más `prisma/`, `test/`, `.gitignore`, `.env.example`, `Dockerfile`.
  - [commit 89b8c1d](https://github.com/GonzaloVila/FitZone-Sports/commit/89b8c1d)
- Integré el remoto que ya tenia un `first commit` (README) y pusheé la estructura.
  - [merge f7d7ad2](https://github.com/GonzaloVila/FitZone-Sports/commit/f7d7ad2)
- Documenté el **arbol completo del backend en el README** (m1 como modelo de referencia, m2–m4 "igual a m1", m5 hexagonal), en vez de replicar archivos vacios en disco.
  - [commit 03060bc](https://github.com/GonzaloVila/FitZone-Sports/commit/03060bc)

#### Decisiones tomadas

1. **Monorepo:** el backend vive en `backend/` dentro de `FitZone-Sports` (el repositorio del equipo), no en un repo separado. Coherente con el skeletón de la Fase C.
2. **Git con ramas personales:** `main` estable + una rama por developer creada en GitHub: `santiago`, `exe` (Exequiel), `gonza` (Gonzalo), `santino` (Santino). Sin `develop`: integración por PR a `main` (se crea `develop` si más adelante hace falta).
3. **El arbol se documenta (README), no se materializa con archivos vacios:** los `.gitkeep` respetan la estructura y los `.ts` placeholder no se replican por módulo (ruido, sin valor compilable).

#### Problemas encontrados y resolución

- **Push rechazado (fetch first):** el remoto ya tenia un `first commit` (README.md) pusheado por un integrante. Resuelto con `git merge --allow-unrelated-histories` (nunca `force push`), preservando ambas historias.
- **Intento de reorg fisica deshecho:** abrí archivos `.ts` placeholder por capa en m1–m4 ([27a9cc6](https://github.com/GonzaloVila/FitZone-Sports/commit/27a9cc6)); al preferirse la documentacion en README, lo deshice con `git revert` ([8515064](https://github.com/GonzaloVila/FitZone-Sports/commit/8515064)) y documenté el arbol en el README. Lección: el "cómo se ve" del codigo se decide en el documento, no creando archivos vacios.

#### Pendiente (sigue SCRUM-10)

- Inyeccion de dependencias por constructor + providers de repositorios (interfaz + adaptador Prisma en M1–M4; puertos/adaptadores en M5).
- Luego: SCRUM-11b/c (ORM + endpoints REST + Swagger).

---

### Semana 4 · SCRUM-11a — Modelo Prisma y migración a Supabase

**Fecha:** 12/09/2026 · **Rama:** `main`

#### Actividades realizadas

- Mapeé el modelo relacional del DBML (14 tablas) a `backend/prisma/schema.prisma` y validé el schema (`prisma validate`).
- Inicialicé el entorno Node del backend (`package.json`, `package-lock.json`) e instalé Prisma.
- Generé y apliqué la migración `20260913000541_init` en la base de Supabase: las **14 tablas** creadas + el índice único parcial **RN-02** (`unq_reserva_turno` en `Reserva`, solo reservas no canceladas).
- Documenté el plan del Sprint 2 en `TFI FitZone - Organizacion Sprint 2.docx` (fuente: `PLAN-SPRINT-2.md`).
  - [commit](https://github.com/GonzaloVila/FitZone-Sports) (pendiente de push)

#### Decisiones tomadas

4. **Prisma 6.19.3 (CLI clásico), no la 8.0 RC:** `npm i prisma` hoy instala la `8.0.0-rc.14` (nuevo "Prisma Platform": sin `generate`/`migrate dev`, exige `prisma.config.ts` y elimina `url` del datasource). Se pinéó `prisma` y `@prisma/client` en `6.19.3` para mantener el workflow `generate`/`migrate` documentado en Unidad II.
5. **Conexión por Session Pooler de Supabase** (`aws-0-sa-east-1.pooler.supabase.com:5432`) en vez del host directo `db.<ref>.supabase.co`, que es IPv6-only y inalcanzable desde el equipo. Mismo puerto 5432, sin cambios en el resto de la config.

#### Problemas encontrados y resolución

- **P1001 (base inalcanzable):** el host directo de Supabase solo resolvía IPv6 y el equipo no tiene ruta IPv6. Resuelto usando la connection string del **Session Pooler** (IPv4).
- **Prisma 8 RC por defecto:** el `latest` de `prisma` apuntaba a la `8.0.0-rc.14`. Resuelto con pin a `6.19.3` (ver Decisión 4).
- **RN-02 no expresable en el schema de Prisma:** el único parcial `WHERE estado <> 'CANCELADA'` se agregó a mano en `migration.sql` y se aplicó con `prisma migrate deploy` (evita el drift check).

#### Pendiente (sigue SCRUM-11a)

- SCRUM-11b: configurar el ORM (client + providers por módulo) y primeros endpoints REST con Swagger.

---

## Templates de integrantes (completar por cada uno)

### Unidad I — Arquitectura · Santiago Rayn (P1)

- _Actividades:_ ...

### Unidad IV — Componentes · Santino Mazzulla (P3)

- _Actividades:_ ...

### Unidades V–VI — Testing/DevOps/Mobile · Gonzalo Vila (P4)

- _Actividades:_ ...