# backend — FitZone Sports (SCRUM-10)

Backend de FitZone Sports (NestJS). Estructura base, espejo de la Fase A del doc
«TFI FitZone - Unidad II - Backend» (`TFI FitZone - Unidad II - Backend.md`).

Los cinco módulos están **en capas**: `controllers → services → repositories → Prisma`.
Los repositorios son, salvo dos excepciones, clases concretas que `PrismaService` inyecta
por constructor, y los services toman de otro módulo lo que necesitan importando su módulo
explícitamente en el `imports`. La dependencia entre módulos queda a la vista en el `imports`
en vez de esconderse detrás de un token opcional.

Las dos excepciones a "repositorio = clase concreta" son los puertos de dominio de M1 y M4
(`MembresiaRepository`, `ReservaRepository`, provistos como **clase abstracta** + `useClass`).
Los únicos tokens no-clase son tres `Symbol` para los multi-providers (arrays): las cadenas
de validación de M3/M4 y las reglas de precio de M4. No hay tokens `string`.

## Grafo de módulos

```
M2 → M1        M3 → M1, M2        M4 → M1, M2        M5 → M1, M3, M4
```

M1 no depende de ningún otro módulo de negocio. M5 lee el precio de M1/M3/M4 por sus
services públicos (`MembresiaPrecioService`, `ReservaPrecioService`,
`ReservaClasePrecioService`) sin consultar tablas ajenas (ADR-07); el cobro interno
(alta, cambio de plan, penalidad, renovación) llega por el bus de eventos, no por import.
M4 también emite la cancelación de una reserva de cancha y M5 la escucha para anular el
pago aprobado (devolución incluida): el grafo sigue sin ciclos.

## Árbol

```
backend/
├── src/
│   ├── main.ts                      → punto de entrada: bootstrap + Swagger
│   ├── app.module.ts                → orquestador raíz (registra M1-M4; M5 sin endpoints)
│   ├── config/                      → validación de variables de entorno
│   │
│   ├── commons/                     → módulo transversal (infraestructura compartida)
│   │   ├── commons.module.ts        → módulo transversal; hoy sin providers propios
│   │   ├── database/                → PrismaService + DatabaseModule
│   │   ├── filters/                 → ProblemFilter global → RFC 9457 + factories de error
│   │   ├── guards/                  → placeholder para guards globales (auth / roles)
│   │   ├── swagger/                 → helpers de Swagger (Problem, problem+json)
│   │   ├── fechas.ts                → zona horaria de la sede y rangos de fecha
│   │   └── paginacion.ts            → opciones de paginación compartidas
│   │
│   └── modules/                     → dominios de negocio
│
│       M1–M5 · ARQUITECTURA EN CAPAS (misma forma en los 5)
│       └── m1-usuarios/    gestión de usuarios            ← modelo de referencia
│           ├── controllers/         → transporte HTTP de M1 (RF-01)
│           ├── services/            → reglas: RN-02 (alta/rol), RN-03 (membresía obligatoria)
│           ├── repositories/        → clases concretas con Prisma (Data Mapper)
│           ├── entities/            → dominio tipado (interfaces; identidad por id numérico)
│           ├── dtos/                → DTOs con los nombres del contrato (SocioIn, SocioOut, …)
│           ├── crons/               → tareas programadas (expiración de membresías)
│           └── usuarios.module.ts   → ensamblador del módulo (DI)
│
│       m2-gimnasio/   control de accesos y sedes   — igual a m1 (+ GimnasioModule exporta SedesService)
│       m3-clases/     horarios y reservas de clase  — igual a m1 (+ observers/ para la lista de espera)
│       m4-canchas/    reservas y precio dinámico    — igual a m1 (+ pricing/ con el patrón Strategy)
│       m5-pagos/      pagos y comprobantes (RF-13/RF-14) — andamiaje sin comportamiento:
│           ├── entities/            → Pago, ConceptoPago, EstadoPago y la frontera SolicitudCobro
│           └── pagos.module.ts      → ensamblador, todavía sin providers
│
├── prisma/
│   ├── schema.prisma                → modelo versionado (14 tablas)
│   └── migrations/                  → migraciones versionadas
├── test/                            → e2e (supertest) + helpers compartidos; los unit
│                                       e integración viven junto al source (src/**)
├── Dockerfile
├── .env.example                     → variables documentadas (sin secretos)
└── .gitignore
```

Los tests **no** viven en una carpeta aparte: los unitarios (`src/**/*.spec.ts`) y los de
integración (`src/**/*.integration-spec.ts`) están al lado del archivo que prueban, y
`test/` queda solo para los e2e (`test/e2e/**/*.e2e-spec.ts`) más los helpers compartidos
(`test/helpers/`, alias `@test/*`). Cada suite tiene su config de Vitest (`vitest.*.config.ts`).

## Comandos

| Comando                   | Qué hace                                        |
| ------------------------- | ----------------------------------------------- |
| `npm run build`           | compilación con `nest build`                    |
| `npm run start:dev`       | servidor en watch                               |
| `npm run test:unit`       | unitarios co-locados, sin base de datos (`vitest.unit.config.ts`) |
| `npm run test:integration`| integración: services directo contra la BD real (`vitest.integration.config.ts`) |
| `npm run test:e2e`        | e2e HTTP contra la base de test (requiere Docker) |

El documento OpenAPI lo publica el propio backend en `/docs` y `/docs-json`, y el
YAML que se entrega sale de ahí. No hay comparador en el repo: la carpeta
`contrato/` es una herramienta local, está en `.gitignore` y se corre con `npx`
según su propio README.

## Estado

- [x] Estructura de carpetas + DI por constructor (SCRUM-10)
- [x] Migración de M1-M5 a capas, sin puertos ni adapters (rama `capas-en-todo-el-backend`)
- [x] Prisma + Supabase conectado y migraciones aplicadas (SCRUM-11b)
- [x] Endpoints REST + Swagger de M1-M4 (SCRUM-11c)
- [x] Alta de RECEPCION con sede de trabajo (A3): `sedeId` obligatorio para RECEPCION y prohibido para EXTERNO/GERENTE en `POST /usuarios`, materializado como fila 1:1 de `EmpleadoSede`; se expone como `sedeId` de solo lectura en `UsuarioOut`
- [x] M5: `PagosService`, `PagoRepository` y las operaciones del contrato (RF-13 / RF-14)
- [x] Autenticación y roles (Unidad III): JWT + guards, TOTP, bloqueados, sync offline
- [x] Patrones de Unidad III (ADR-10): State, Observer, Chain, reglas de precio
- [x] Suite en pirámide: unitarios + integración (co-locados) + e2e (`test:unit` / `test:integration` / `test:e2e`)
