-- Revertir el ON DELETE SET NULL de PagoMembresia.membresia_id. Con la baja
-- LOGICA del socio la membresia ya no se borra, asi que el SetNull es codigo
-- muerto y el enlace nunca deberia ser NULL.

-- 1) Limpiar enlaces huerfanos de la era de baja fisica (membresia_id NULL) y
--    los Pago que queden sin subtipo (aDominio lanzaria sobre ellos).
DELETE FROM "PagoMembresia" WHERE "membresia_id" IS NULL;
DELETE FROM "Pago"
  WHERE "id" NOT IN (SELECT "id_pago" FROM "PagoReserva")
    AND "id" NOT IN (SELECT "id_pago" FROM "PagoMembresia");

-- 2) membresia_id vuelve a ser NOT NULL y la FK pierde el SET NULL.
ALTER TABLE "PagoMembresia" ALTER COLUMN "membresia_id" SET NOT NULL;
ALTER TABLE "PagoMembresia" DROP CONSTRAINT IF EXISTS "PagoMembresia_membresia_id_fkey";
ALTER TABLE "PagoMembresia"
  ADD CONSTRAINT "PagoMembresia_membresia_id_fkey"
  FOREIGN KEY ("membresia_id") REFERENCES "Membresia"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
