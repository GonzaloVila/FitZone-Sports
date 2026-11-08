# FitZone Sports

## 1. Qué es el sistema
FitZone Sports es una plataforma integral para la gestión operativa y administrativa de una cadena de gimnasios con múltiples sedes. Permite a los socios gestionar sus membresías, reservar turnos en canchas deportivas, inscribirse en clases grupales con lista de espera automática y acceder a las instalaciones mediante credenciales digitales con código QR dinámico. Para el personal administrativo y la gerencia, centraliza el control de accesos y aforo en tiempo real, la administración del personal de cada sede, el registro de cobros con emisión de comprobantes en PDF y la generación de reportes financieros consolidados.

---

## 2. Integrantes del equipo
| Rol | Nombre y Apellido | Usuario Git | Responsabilidad principal |
|---|---|---|---|
| P1 | Santiago Rayn | `srayn` | `raynarg` | Software Architect |
| P2 | Exequiel Ansaldi | `exeansaldi0` / `Exequiel-Ansaldi` | Backend Developer |
| P3 | Santino Mazzulla | `mazzullasantino85` / `Santi` | Frontend Developer |
| P4 | Gonzalo Vila | `gonzalovila08` / `gonza` | Dev Ops Engineer |

---

## 3. Puesta en marcha

> **Requisitos previos:** Node.js (v20 o superior), npm y Docker (para PostgreSQL).

### Paso 1: Clonar el repositorio
```bash
git clone git@github.com:GonzaloVila/FitZone-Sports.git && cd FitZone-Sports
```

### Paso 2: Levantar la base de datos PostgreSQL local
```bash
docker compose -f docker-compose.test.yml up -d
```

### Paso 3: Configurar variables de entorno del backend
```bash
cp backend/.env.example backend/.env && sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://fitzone:fitzone@localhost:55432/fitzone_test?schema=public"|' backend/.env
```

### Paso 4: Instalar dependencias, aplicar migraciones, sembrar datos de prueba y compilar backend
```bash
cd backend && npm install && npx prisma migrate deploy && npx prisma db execute --schema prisma/schema.prisma --file ../docs/db/seed_supabase_test_data.sql && npm run build && cd ..
```

### Paso 5: Instalar dependencias del frontend e iniciar ambos servidores
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

| Rol del sistema | Nombre y Apellido | Email (Usuario) | Contraseña | Detalle / Estado |
|---|---|---|---|---|
| **GERENTE** | Valeria Rossi | `valeria.rossi@fitzone.com` | `Password123!` | Gerencia general (acceso total a sedes, reportes y personal) |
| **RECEPCION** | Lucas Benítez | `lucas.benitez@fitzone.com` | `Password123!` | Personal asignado a Sede Central Belgrano (control de aforo e ingresos) |
| **SOCIO** (Al día) | Camila Domínguez | `camila.dominguez@gmail.com` | `Password123!` | Socia con membresía activa (Plan Anual), sin deuda |
| **SOCIO** (En mora) | Esteban Morales | `esteban.morales@gmail.com` | `Password123!` | Socio con membresía vencida (Plan Trimestral) para probar rechazos por mora |
| **EXTERNO** | Sofía Navarro | `sofia.navarro@hotmail.com` | `Password123!` | Cliente no socio habilitado para reserva y pago de canchas |

---

## 5. Tabla de enlaces

| Recurso | Enlace | Estado / Ubicación |
|---|---|---|
| **ADR (Architectural Decision Records)** | [docs/adr/](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/adr) | Disponible en repositorio (ADR-001 a ADR-013) |
| **Diagramas de Casos de Uso** | [Casos de Uso Módulo 3 — Clases](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/UserCaseDiagrams/Modulo3_Clases_CasosDeUso.md) | Disponible en repositorio |
| **Diagrama de Base de Datos (DBML)** | [fitzone.dbml](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/db/fitzone.dbml) | Disponible en repositorio |
| **Diagramas de Arquitectura (C4)** | [A COMPLETAR] | [A COMPLETAR] |
| **Manuales de Usuario y Operación** | [Guía de Estudio y Arquitectura](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/Guia%20de%20Estudio%20y%20Arquitectura%20-%20FitZone%20Sports.pdf) | Disponible en repositorio |
| **Manual de Puesta en Marcha Técnica** | [initialize_project.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/initialize_project.md) | Disponible en repositorio |
| **Bitácora General** | [LOG.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/LOG.md) | Disponible en repositorio |
| **Bitácora — Exequiel Ansaldi** | [docs/bitacoras/LOG-ansaldi.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-ansaldi.md) | [A COMPLETAR] |
| **Bitácora — Gonzalo Vila** | [docs/bitacoras/LOG-vila.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-vila.md) | [A COMPLETAR] |
| **Bitácora — Santiago Rayn** | [docs/bitacoras/LOG-rayn.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-rayn.md) | [A COMPLETAR] |
| **Bitácora — Santino Mazzulla** | [docs/bitacoras/LOG-santino.md](file:///home/raynsanty/Documents/Sistemas/Facultad/3/Prog5/FitZone-Sports/docs/bitacoras/LOG-santino.md) | [A COMPLETAR] |

---

## 6. Estado de la suite de pruebas y porcentaje de cobertura

### Backend
- **Pruebas Unitarias:**
  - Archivos evaluados: 55 archivos (54 pasados, 1 omitido por flag de generación de muestras)
  - Tests ejecutados: **452 pasados**, 1 omitido (453 totales)
  - Cobertura global (`vitest --coverage`):
    - **Líneas (Lines):** 61.86%
    - **Sentencias (Statements):** 61.62%
    - **Ramas (Branches):** 54.17%
    - **Funciones (Functions):** 58.95%
- **Comandos de ejecución:**
  ```bash
  cd backend
  npm run test:unit           # Tests unitarios sin base de datos
  npm run test:integration    # Tests de integración contra BD
  npm run test:e2e            # Tests de punta a punta HTTP
  ```

### Frontend
- **Pruebas Unitarias y de Componentes:**
  - Archivos evaluados: 96 archivos pasados
  - Tests ejecutados: **983 pasados** (100% exitosos)
  - Cobertura: [A COMPLETAR]
- **Comandos de ejecución:**
  ```bash
  cd frontend
  npm test                    # Ejecución de suite de componentes y lógica (Vitest)
  npm run type-check          # Verificación estática de tipos (vue-tsc)
  ```
