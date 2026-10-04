# FitZone-Sports

Backend de la plataforma de gestión de la cadena de gimnasios **FitZone Sports** (TFI — Programación V). Monolito modular en **NestJS + TypeScript + Prisma + PostgreSQL (Supabase)**.

## Estructura

```
backend/
├── prisma/
│   ├── schema.prisma        # Modelo de datos (14 tablas)
│   └── migrations/          # Migraciones versionadas
├── src/
│   ├── app.module.ts        # Ensamblador raíz (módulos + EventEmitter)
│   ├── commons/             # database, filters (problem+json), guards (JWT/roles), eventos, fechas
│   ├── config/              # Validación de entorno (zod)
│   └── modules/
│       ├── auth/            # Login JWT + registro de QR TOTP (Unidad III)
│       ├── m1-usuarios/     # Usuarios, socios, membresías, bloqueados
│       ├── m2-gimnasio/     # Sedes, ingresos, aforo, sincronización offline
│       ├── m3-clases/       # Clases, reservas, lista de espera (Observer)
│       ├── m4-canchas/      # Canchas, reservas, precio dinámico (Strategy)
│       └── m5-pagos/        # Pagos, comprobante PDF, renovación automática (RF-02)
└── test/                    # e2e (M1–M5, errores) + smokes locales (untracked)
```

## Stack

- **Runtime:** Node.js + NestJS 12
- **ORM:** Prisma 6 sobre PostgreSQL (Supabase)
- **Auth:** JWT (`@nestjs/jwt` + Passport) + guards por rol
- **QR dinámico:** TOTP (`otplib`), secreto cifrado AES-256-GCM
- **Cobro interno RF-02:** event bus (`@nestjs/event-emitter`) + cron de renovación
- **PDF:** PDFKit
- **Tests:** Vitest (unit) + supertest (e2e)

## Levantar

```bash
cd backend
cp .env.example .env        # DATABASE_URL de Supabase (o Postgres local)
npm install
npx prisma migrate deploy
npm run build
npm run start:dev           # http://localhost:3000/api/v1 · Swagger en /docs
```

## Tests

```bash
npm run test:unit           # unitarios (Vitest)
npm run test:e2e            # e2e contra base local (docker-compose.test.yml)
npx tsc --noEmit            # typecheck
```

Los e2e también corren contra Supabase con `DATABASE_URL` apuntando a esa base + `FITZONE_E2E_ALLOW_REMOTE=1`.

## Contrato

El contrato OpenAPI canónico vive en `backend/contrato/openapi.yaml` (gitignored) y se exporta al vault con `contrato/exportar.ts`. El comparador verifica que el backend publique lo que el contrato declara.