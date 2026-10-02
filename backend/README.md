# backend — FitZone Sports (SCRUM-10)

Backend de FitZone Sports (NestJS). Estructura base, espejo de la Fase A del doc
«TFI FitZone - Unidad II - Backend» (`TFI FitZone - Unidad II - Backend.md`).

Los cinco módulos están **en capas**: `controllers → services → repositories → Prisma`.
No hay puertos, adapters ni tokens: los repositorios son clases concretas que
`PrismaService` inyecta por constructor, y los services toman de otro módulo lo que
necesitan importando su módulo explícitamente en el `imports`. La dependencia entre
módulos queda a la vista en el `imports` en vez de esconderse detrás de un token
opcional.

## Grafo de módulos

```
M2 → M1        M3 → M1, M2        M4 → M1, M2        M5 → (nada todavía)
```

M1 no depende de ningún otro módulo de negocio. M5 todavía no cablea imports porque
sus cinco operaciones del contrato (RF-13 / RF-14) no están implementadas; cuando
existan, la dependencia va de M1/M4 hacia `PagosModule`.

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
├── contrato/                        → comparador contra el OpenAPI (gitignored)
├── test/                            → e2e con supertest
├── Dockerfile
├── .env.example                     → variables documentadas (sin secretos)
└── .gitignore
```

## Comandos

| Comando                   | Qué hace                                        |
| ------------------------- | ----------------------------------------------- |
| `npm run build`           | compilación con `nest build`                    |
| `npm run start:dev`       | servidor en watch                               |
| `npm run test:unit`       | unitarios sin base de datos (`vitest.unit.config.ts`) |
| `npm run test:e2e`        | e2e contra la base de test (requiere Docker)    |

El contrato se compara aparte: `FITZONE_CONTRACT_PATH` y `FITZONE_CONTRATO_URL`
apuntan al YAML del vault y al `/docs-json` del servidor, y el alcance se calcula por
rutas realmente publicadas.

## Estado

- [x] Estructura de carpetas + DI por constructor (SCRUM-10)
- [x] Migración de M1-M5 a capas, sin puertos ni adapters (rama `capas-en-todo-el-backend`)
- [x] Prisma + Supabase conectado y migraciones aplicadas (SCRUM-11b)
- [x] Endpoints REST + Swagger de M1-M4 (SCRUM-11c)
- [ ] M5: `PagosService`, `PagoRepository` y las cinco operaciones del contrato (RF-13 / RF-14)
- [ ] Autenticación y roles (Unidad III)
