-- Ingreso pasa a referenciar al SOCIO (solo los socios entran al gimnasio; los
-- externos solo alquilan canchas). La baja logica del socio garantiza que la FK
-- a Socio siga valida (la fila no se borra).

-- 1) Agregar socio_id nullable (temporal) y backfillear desde el usuario.
ALTER TABLE "Ingreso" ADD COLUMN "socio_id" INTEGER;
UPDATE "Ingreso" i
  SET "socio_id" = s."id"
  FROM "Socio" s
  WHERE s."usuario_id" = i."usuario_id";

-- 2) Huerfanos: ingresos cuyo usuario no tiene Socio (socios borrados fisicamente
--    antes de la baja logica). Se eliminan para poder poner NOT NULL.
DELETE FROM "Ingreso" WHERE "socio_id" IS NULL;

-- 3) NOT NULL + FK a Socio.
ALTER TABLE "Ingreso" ALTER COLUMN "socio_id" SET NOT NULL;
ALTER TABLE "Ingreso"
  ADD CONSTRAINT "Ingreso_socio_id_fkey"
  FOREIGN KEY ("socio_id") REFERENCES "Socio"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Sacar el indice RN-01 viejo (sobre usuario_id) y la columna usuario_id.
DROP INDEX IF EXISTS "ingreso_usuario_abierto_unq";
ALTER TABLE "Ingreso" DROP CONSTRAINT IF EXISTS "Ingreso_usuario_id_fkey";
ALTER TABLE "Ingreso" DROP COLUMN "usuario_id";

-- 5) Recrear el indice parcial unico de RN-01 sobre socio_id.
CREATE UNIQUE INDEX "ingreso_socio_abierto_unq"
  ON "Ingreso" ("socio_id")
  WHERE "fecha_hora_egreso" IS NULL;
