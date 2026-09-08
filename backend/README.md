# backend — FitZone Sports (SCRUM-10)

Backend de FitZone Sports (NestJS). Estructura base, espejo de la Fase A del doc
«TFI FitZone - Unidad II - Backend» (`TFI FitZone - Unidad II - Backend.md`).

## Árbol

```
backend/
├── src/
│   ├── main.ts                      → punto de entrada: bootstrap + Swagger
│   ├── app.module.ts                → orquestador raíz
│   ├── commons/                     → módulo transversal (infraestructura compartida)
│   │   ├── commons.module.ts        → expone los servicios de commons
│   │   ├── database/                → PrismaService + configuración de BD
│   │   ├── mediador/                → MediadorService (ADR-01 · RF-02 / RF-13)
│   │   ├── filters/                 → ErrorFilter global → RFC 9457
│   │   └── guards/                  → guards globales (auth / autorización)
│   └── modules/                     → dominios de negocio
│       M1–M4 · ARQUITECTURA EN CAPAS (misma forma en los 4):
│       ├── m1-usuarios/             → gestión de usuarios y membresías
│       ├── m2-gimnasio/             → control de accesos y sedes
│       ├── m3-clases/               → horarios y reservas de clase
│       ├── m4-canchas/              → reservas y precio dinámico
│       │      cada módulo M1–M4:
│       │      ├── controllers/  services/  repositories/ + repositories/prisma/
│       │      ├── entities/  dtos/  y  xxx.module.ts (ensamblador DI)
│       └── m5-pagos/                → M5 · ARQUITECTURA HEXAGONAL (pagos y facturación)
│              ├── domain/           → models, exceptions, ports/in (ProcesarPago), ports/out
│              ├── application/      → use-cases, dtos
│              ├── infrastructure/   → adapters/in (web, events), adapters/out (database, gateway,
│              │                        pdf), entities
│              └── pagos.module.ts   → ensamblador
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