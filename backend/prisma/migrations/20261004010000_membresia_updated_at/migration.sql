-- GET /bloqueados (RF-04, Unidad III, Fase 4): la sincronizacion incremental
-- del puesto offline pide "no vigentes actualizadas desde X", y no habia
-- ninguna columna que marcara cuando cambio el estado de una Membresia.
-- DEFAULT now() backfillea las filas existentes; de ahi en mas Prisma la
-- mantiene sola via @updatedAt en cada update/updateMany (incluye el cron de
-- VENCIDA y el PATCH de SUSPENDIDA/ACTIVA, sin tocar el service).
ALTER TABLE "Membresia" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now();
