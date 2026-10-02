-- AlterTable
--
-- Membresia no tenia precio: RF-02 fija los tres planes (MENSUAL, TRIMESTRAL,
-- ANUAL) pero el enunciado nunca da sus valores. Sin columna, el cobro de una
-- membresia (M5, RF-13) no tendria de donde sacar el importe, porque PagoIn del
-- contrato no manda `monto` y el precio lo computa la regla de negocio.
--
-- El precio se congela por fila y no se lee de una tabla de planes. La fila es
-- el snapshot, igual que Reserva.precio_aplicado en M4 congela el de la cancha
-- al reservar: si mañana sube la tarifa, el comprobante de ayer sigue cuadrando
-- con lo que se cobro ayer.
--
-- DECIMAL(65,30) como costo_por_hora, precio_aplicado y Pago.monto.
--
-- En tres pasos y no con DEFAULT a proposito: con DEFAULT 30000 toda fila
-- TRIMESTRAL o ANUAL quedaria con el precio de MENSUAL hasta que alguien se
-- acuerde de corregirla, y el bug pasaria inadvertido. Primero la columna
-- nullable, despues el UPDATE que la siembra por plan, y recien ahi el NOT NULL
-- que obliga a que toda alta futura mande el precio explicito.
--
-- Los valores del backfill son los de PRECIOS_PLAN en
-- m1-usuarios/entities/membresia.entity.ts. Quedan escritos aqui a mano porque
-- una migracion es historia y no codigo: si manana el equipo cambia un precio,
-- esta migracion NO se toca (las filas viejas conservan lo que se les cobró) y
-- el cambio va en una nueva.
ALTER TABLE "Membresia" ADD COLUMN "precio" DECIMAL(65,30);

UPDATE "Membresia"
SET "precio" = CASE "plan"
  WHEN 'MENSUAL' THEN 30000
  WHEN 'TRIMESTRAL' THEN 80000
  WHEN 'ANUAL' THEN 280000
END;

ALTER TABLE "Membresia" ALTER COLUMN "precio" SET NOT NULL;