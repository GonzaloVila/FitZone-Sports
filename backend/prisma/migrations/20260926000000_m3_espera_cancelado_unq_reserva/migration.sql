-- M3 Clases Grupales (RF-07 y RF-08)
-- 1. Agrega el estado CANCELADO a EstadoEspera para soportar la baja lógica (RF-08).
-- 2. Crea el índice parcial único sobre ReservaClase (clase_id, socio_id) WHERE estado = 'CONFIRMADA'
--    para blindar la consistencia atómica frente a peticiones concurrentes del mismo socio.

-- AlterEnum
ALTER TYPE "EstadoEspera" ADD VALUE IF NOT EXISTS 'CANCELADO';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "unq_reserva_clase_socio_activa"
  ON "ReservaClase" ("clase_id", "socio_id")
  WHERE "estado" = 'CONFIRMADA';
