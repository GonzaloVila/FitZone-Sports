# backend — FitZone Sports (SCRUM-10)

Backend de FitZone Sports (NestJS). Estructura base, espejo de la Fase A del doc
«TFI FitZone - Unidad II - Backend» (`TFI FitZone - Unidad II - Backend.md`).

## Árbol

```
backend/
├── src/
│   ├── main.ts                      → punto de entrada: bootstrap + Swagger
│   ├── app.module.ts                → orquestador raíz
│   │
│   ├── commons/                     → módulo transversal (infraestructura compartida)
│   │   ├── commons.module.ts        → expone los servicios de commons
│   │   ├── database/                → PrismaService + configuración de BD
│   │   ├── mediador/                → MediadorService (ADR-01 · RF-02 / RF-13)
│   │   ├── filters/                 → ErrorFilter global → RFC 9457
│   │   └── guards/                  → guards globales (auth / autorización)
│   │
│   └── modules/                     → dominios de negocio
│
│       M1–M4 · ARQUITECTURA EN CAPAS (misma forma en los 4)
│       └── m1-usuarios/    gestión de usuarios            ← modelo de referencia
│           ├── controllers/
│           │   └── usuarios.controller.ts        → transporte HTTP de M1 (RF-01)
│           ├── services/
│           │   └── usuarios.service.ts           → reglas: RN-02 (alta/rol)
│           ├── repositories/
│           │   ├── usuario.repository.ts          → interfaz del repo (puerto)
│           │   └── prisma/
│           │       └── prisma-usuario.repository.ts  → adaptador Prisma (Data Mapper)
│           ├── entities/
│           │   └── usuario.entity.ts             → entidad de dominio (igualdad por id numérico)
│           ├── dtos/
│           │   └── crear-usuario.dto.ts          → DTO de entrada (validación alta)
│           └── usuarios.module.ts                → ensamblador del módulo (DI)
│
│       m2-gimnasio/   control de accesos y sedes   — igual a m1
│       m3-clases/     horarios y reservas de clase  — igual a m1
│       m4-canchas/    reservas y precio dinámico    — igual a m1
│
│       M5 · ARQUITECTURA HEXAGONAL
│       └── m5-pagos/    procesamiento de pagos y facturación
│           ├── domain/
│           │   ├── models/                         → entidades puras (Pago, Factura)
│           │   ├── exceptions/                     → PagoRechazadoException…
│           │   └── ports/
│           │       ├── in/                         → contratos de entrada (ProcesarPago)
│           │       └── out/                        → contratos de salida (RepoPagos, PasarelaPago, GeneradorPdf)
│           ├── application/
│           │   ├── use-cases/                      → implementa los puertos in
│           │   └── dtos/                           → DTOs del use-case
│           ├── infrastructure/
│           │   ├── adapters/
│           │   │   ├── in/
│           │   │   │   ├── web/                    → controladores REST (pagos.controller.ts)
│           │   │   │   └── events/                 → listeners ('reserva.creada')
│           │   │   └── out/
│           │   │       ├── database/               → repositorio Prisma (pago.repository.impl.ts)
│           │   │       ├── gateway/                → pasarela: mock (dev) / MercadoPago (prod)
│           │   │       └── pdf/                    → generador PDF (RF-14)
│           │   └── entities/                       → entidades exclusivas del ORM
│           └── pagos.module.ts                     → ensamblador (encaja los adapters)
│
├── prisma/
│   ├── schema.prisma                → modelo versionado (llega en Fase B, SCRUM-11a)
│   └── migrations/                  → migraciones versionadas
├── test/                            → e2e con supertest (se amplía en Unidad V)
├── Dockerfile                       → Unidad V
├── .env.example                     → variables documentadas (sin secretos)
└── .gitignore
```

## Estado

- [x] Estructura de carpetas + placeholders (SCRUM-10 · parte estructural)
- [ ] DI por constructor + providers de repositorios (SCRUM-10)
- [ ] Prisma + Supabase conectado (SCRUM-11b)
- [ ] Endpoints REST + Swagger (SCRUM-11c)
