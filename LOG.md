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
2. **Git simplificado:** solo `main` por ahora. `develop` y `feat/*` se crean cuando hagan falta (patrón objetivo del doc 4.4).
3. **El arbol se documenta (README), no se materializa con archivos vacios:** los `.gitkeep` respetan la estructura y los `.ts` placeholder no se replican por módulo (ruido, sin valor compilable).

#### Problemas encontrados y resolución

- **Push rechazado (fetch first):** el remoto ya tenia un `first commit` (README.md) pusheado por un integrante. Resuelto con `git merge --allow-unrelated-histories` (nunca `force push`), preservando ambas historias.
- **Intento de reorg fisica deshecho:** abrí archivos `.ts` placeholder por capa en m1–m4 ([27a9cc6](https://github.com/GonzaloVila/FitZone-Sports/commit/27a9cc6)); al preferirse la documentacion en README, lo deshice con `git revert` ([8515064](https://github.com/GonzaloVila/FitZone-Sports/commit/8515064)) y documenté el arbol en el README. Lección: el "cómo se ve" del codigo se decide en el documento, no creando archivos vacios.

#### Pendiente (sigue SCRUM-10)

- Inyeccion de dependencias por constructor + providers de repositorios (interfaz + adaptador Prisma en M1–M4; puertos/adaptadores en M5).
- Luego: SCRUM-11a (modelo Prisma) y SCRUM-11b/c (ORM + endpoints REST + Swagger).

---

## Templates de integrantes (completar por cada uno)

### Unidad I — Arquitectura · Santiago Rayn (P1)

- _Actividades:_ ...

### Unidad IV — Componentes · Santino Mazzulla (P3)

- _Actividades:_ ...

### Unidades V–VI — Testing/DevOps/Mobile · Gonzalo Vila (P4)

- _Actividades:_ ...