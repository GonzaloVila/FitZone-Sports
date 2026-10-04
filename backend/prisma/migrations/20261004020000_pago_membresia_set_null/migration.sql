-- RF-02 (historial de pagos) + baja de socio: la membresía se borra con el socio,
-- pero el Pago queda como historial. La FK de PagoMembresia pasa a nullable con
-- ON DELETE SET NULL: al borrar la Membresia, el enlace queda con membresia_id NULL
-- y el Pago (monto, fecha, comprobante) sobrevive.
ALTER TABLE "PagoMembresia" ALTER COLUMN "membresia_id" DROP NOT NULL;
ALTER TABLE "PagoMembresia" DROP CONSTRAINT "PagoMembresia_membresia_id_fkey";
ALTER TABLE "PagoMembresia" ADD CONSTRAINT "PagoMembresia_membresia_id_fkey"
  FOREIGN KEY ("membresia_id") REFERENCES "Membresia"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;