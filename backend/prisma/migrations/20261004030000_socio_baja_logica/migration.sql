-- Baja logica del socio: en vez de borrar la fila, se marca `activo=false` con
-- `fecha_baja`. Asi el historial de ingresos y pagos conserva la FK al socio.
ALTER TABLE "Socio" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Socio" ADD COLUMN "fecha_baja" TIMESTAMPTZ(3);
