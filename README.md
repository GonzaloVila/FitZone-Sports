# FitZone Sports

## 1. Qué es el sistema
FitZone Sports es una plataforma integral para la gestión operativa y administrativa de una cadena de gimnasios con múltiples sedes. Permite a los socios gestionar sus membresías, reservar turnos en canchas deportivas, inscribirse en clases grupales con lista de espera automática y acceder a las instalaciones mediante credenciales digitales con código QR dinámico. Para el personal administrativo y la gerencia, centraliza el control de accesos y aforo en tiempo real, la administración del personal de cada sede, el registro de cobros con emisión de comprobantes en PDF y la generación de reportes financieros consolidados.

---

## 2. Integrantes del equipo
| Rol | Nombre y Apellido | Usuario Git | Responsabilidad principal |
|---|---|---|---|
| P1 | Santiago Rayn | `srayn` / `raynarg` | Software Architect |
| P2 | Exequiel Ansaldi | `exeansaldi0` / `Exequiel-Ansaldi` | Backend Developer |
| P3 | Santino Mazzulla | `mazzullasantino85` / `Santi` | Frontend Developer |
| P4 | Gonzalo Vila | `gonzalovila08` / `gonza` | Dev Ops Engineer |

---

## 3. Puesta en marcha

### Opción A: todo el sistema con un comando (recomendada)

> **Requisito previo:** Docker Desktop (o Docker Engine con Docker Compose).

```bash
git clone git@github.com:GonzaloVila/FitZone-Sports.git && cd FitZone-Sports && docker compose up --build
```

La primera vez construye las imágenes (unos minutos), aplica las migraciones y carga el seed (25 sedes y los usuarios de la sección 4).

> **Verificación:**
> - Aplicación web (Frontend): `http://localhost:8080`
> - API REST (Backend): `http://localhost:3000/api/v1`
> - Documentación Swagger: `http://localhost:3000/docs`

- `docker compose down` apaga el sistema y conserva los datos.
- `docker compose down -v` borra también los datos; el próximo arranque vuelve a cargar el seed.
- Las variables (secretos, puertos y URLs) son opcionales y se documentan en `.env.example`.

### Opción B: modo desarrollo (con recarga en caliente)

> **Requisitos previos:** Node.js (v22.18 o superior), npm y Docker (para PostgreSQL).

#### Paso 1: Clonar el repositorio
```bash
git clone git@github.com:GonzaloVila/FitZone-Sports.git && cd FitZone-Sports
```

#### Paso 2: Levantar la base de datos PostgreSQL local
```bash
docker compose -f docker-compose.test.yml up -d
```

#### Paso 3: Configurar variables de entorno del backend
```bash
cp backend/.env.example backend/.env && sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://fitzone:fitzone@localhost:55432/fitzone_test?schema=public"|' backend/.env
```

#### Paso 4: Instalar dependencias, aplicar migraciones, sembrar datos de prueba y compilar backend
```bash
cd backend && npm install && npx prisma migrate deploy && npx prisma db execute --schema prisma/schema.prisma --file ../docs/db/seed_supabase_test_data.sql && npm run build && cd ..
```

#### Paso 5: Instalar dependencias del frontend e iniciar ambos servidores
```bash
cd frontend && npm install && npm run build && cd .. && (cd backend && npm run start:dev &) && (cd frontend && npm run dev)
```

> **Verificación:**
> - Aplicación web (Frontend): `http://localhost:5173`
> - API REST (Backend): `http://localhost:3000/api/v1`
> - Documentación Swagger: `http://localhost:3000/docs`

---

## 4. Credenciales de usuarios de prueba (Seed)

> **Contraseña universal para todos los usuarios de prueba:** `Password123!`

> El seed (`docs/db/seed_supabase_test_data.sql`) carga **25 sedes**, cada una con canchas y clases, y usuarios de todos los roles.

| Rol del sistema | Nombre y Apellido | Email (Usuario) | Contraseña | Detalle / Estado |
|---|---|---|---|---|
| **GERENTE** | Valeria Rossi | `valeria.rossi@fitzone.com` | `Password123!` | Gerencia general (acceso total a sedes, reportes y personal) |
| **RECEPCION** | Lucas Benítez | `lucas.benitez@fitzone.com` | `Password123!` | Personal asignado a Sede Central Belgrano (control de aforo e ingresos) |
| **SOCIO** (Al día) | Camila Domínguez | `camila.dominguez@gmail.com` | `Password123!` | Socia con membresía activa (Plan Anual), sin deuda |
| **SOCIO** (En mora) | Esteban Morales | `esteban.morales@gmail.com` | `Password123!` | Socio con membresía vencida (Plan Trimestral) para probar rechazos por mora |
| **EXTERNO** | Sofía Navarro | `sofia.navarro@hotmail.com` | `Password123!` | Cliente no socio habilitado para reserva y pago de canchas |
| **RECEPCION** (sedes 4 a 25) | Recepción &lt;sede&gt; | `recepcion.sede<N>@fitzone.com` | `Password123!` | Un recepcionista por sede; `N` es el id de la sede (4 a 25) |
| **SOCIO** (sedes 4 a 25) | Socio &lt;sede&gt; | `socio.sede<N>@fitzone.com` | `Password123!` | Un socio activo por sede, con plan mensual, trimestral o anual |
| **EXTERNO** | Tomás Herrera / Lucía Paz | `tomas.herrera@gmail.com` / `lucia.paz@gmail.com` | `Password123!` | Clientes externos adicionales |

---

## 5. Tabla de enlaces

| Recurso | Enlace | Estado / Ubicación |
|---|---|---|
| **ADR (Architectural Decision Records)** | [docs/adr/](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/adr) | Disponible en repositorio (ADR-001 a ADR-013) |
| **Diagramas de Casos de Uso** | [Casos de Uso Módulo 3 — Clases](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/UserCaseDiagrams/Modulo3_Clases_CasosDeUso.md) | Disponible en repositorio |
| **Diagrama de Base de Datos (DBML)** | [fitzone.dbml](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/db/fitzone.dbml) | Disponible en repositorio |
| **Diagramas de Arquitectura (C4)** | [A COMPLETAR] | [A COMPLETAR] |
| **Manuales de Usuario y Operación** | [Guía de Estudio y Arquitectura](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/Guia%20de%20Estudio%20y%20Arquitectura%20-%20FitZone%20Sports.pdf) | Disponible en repositorio |
| **Manual de Instalación y Operación** | [docs/manuales/manual-instalacion-operacion.md](docs/manuales/manual-instalacion-operacion.md) | Requisitos, puesta en marcha, variables, migraciones, respaldo, reversión, operación offline y alta de sede |
| **Manual de Puesta en Marcha Técnica** | [initialize_project.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/initialize_project.md) | Disponible en repositorio |
| **Guía de Pruebas** | [docs/pruebas.md](docs/pruebas.md) | Cómo correr cada capa, leer la cobertura y los resultados E2E |
| **Bitácora General** | [LOG.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/LOG.md) | Disponible en repositorio |
| **Bitácora — Exequiel Ansaldi** | [docs/bitacoras/LOG-ansaldi.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-ansaldi.md) | [A COMPLETAR] |
| **Bitácora — Gonzalo Vila** | [docs/bitacoras/LOG-vila.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-vila.md) | [A COMPLETAR] |
| **Bitácora — Santiago Rayn** | [docs/bitacoras/LOG-rayn.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-rayn.md) | [A COMPLETAR] |
| **Bitácora — Santino Mazzulla** | [docs/bitacoras/LOG-santino.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-santino.md) | [A COMPLETAR] |

---

## 6. Estado de la suite de pruebas y porcentaje de cobertura

> Cómo correr cada capa y cómo leer los resultados: [docs/pruebas.md](docs/pruebas.md). Estrategia y umbrales: ADR-007.

### Backend
- **Pruebas Unitarias:** 73 archivos (72 pasados, 1 omitido por flag de generación de muestras), **670 tests pasados**.
  - Cobertura de los unitarios (`npm run test:cov`, umbral mínimo 70% líneas / 65% ramas):
    - **Líneas (Lines):** 71.49%
    - **Sentencias (Statements):** 71.29%
    - **Ramas (Branches):** 66.84%
    - **Funciones (Functions):** 64.22%
- **Pruebas de Integración (base de datos real):** 13 archivos, **82 tests pasados**.
- **Pruebas de API por HTTP (Supertest):** 28 archivos, **189 tests pasados**.
- **Comandos de ejecución:**
  ```bash
  cd backend
  npm test                    # Tests unitarios sin base de datos
  npm run test:cov            # Unitarios + tabla de cobertura en la terminal
  npm run test:db:up          # Levanta la base de tests (requiere Docker Desktop abierto)
  npm run test:db:migrate     # Aplica las migraciones a la base de tests
  npm run test:integration    # Tests de integración contra la base de tests
  npm run test:api            # Tests de API por HTTP (supertest)
  npm run test:all            # Cobertura + integración + API
  ```

### Frontend
- **Pruebas Unitarias y de Componentes:**
  - Archivos evaluados: 131 archivos pasados
  - Tests ejecutados: **1254 pasados** (100% exitosos)
  - Cobertura (`npm run test:cov`, umbral mínimo 82% líneas / 72% ramas): Líneas 84.97%, Sentencias 83.25%, Ramas 74.75%, Funciones 75.53%
- **Comandos de ejecución:**
  ```bash
  cd frontend
  npm test                    # Ejecución de suite de componentes y lógica (Vitest)
  npm run test:watch          # Modo watch
  npm run test:cov            # Tests + tabla de cobertura en la terminal
  npm run type-check          # Verificación estática de tipos (vue-tsc)
  ```

### E2E (Playwright)
- **Pruebas de extremo a extremo:** 6 archivos, **17 recorridos pasados**, uno por requisito (RF-01 a RF-14, RN-01 a RN-03). El navegador (Chromium) usa el frontend real, que llama a la API real, que usa PostgreSQL en Docker. Ver ADR-007.
  - Incluye la prueba de concurrencia de RN-02 desde la interfaz: dos usuarios, cada uno en su navegador, confirman el mismo turno a la vez y solo uno lo consigue.
- **Comandos de ejecución** (requiere Docker Desktop abierto):
  ```bash
  cd e2e
  npm install
  npm run instalar-navegador  # Solo la primera vez: descarga Chromium
  npm test                    # Prepara la base E2E (seed limpio), levanta backend y frontend y corre los 17 recorridos
  ```
  La base E2E (`fitzone_e2e`) es otra base dentro del mismo contenedor de pruebas: no se mezcla con la de integración ni con Supabase. El backend corre en el puerto 3100 y el frontend en el 5180, así que no chocan con los de desarrollo.
