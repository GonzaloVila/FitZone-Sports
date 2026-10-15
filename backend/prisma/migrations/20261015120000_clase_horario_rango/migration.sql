-- RF-06: la clase pasa de un unico `horario` (String ISO, solo inicio) a un rango
-- `horario_inicio` / `horario_fin` en timestamptz(3), como Reserva.fecha_hora_*.
-- Backfill de filas existentes: inicio = horario, fin = horario + 1 hora.
ALTER TABLE "Clase" ADD COLUMN "horario_inicio" timestamptz(3);
ALTER TABLE "Clase" ADD COLUMN "horario_fin" timestamptz(3);

UPDATE "Clase"
   SET "horario_inicio" = "horario"::timestamptz,
       "horario_fin"    = "horario"::timestamptz + interval '1 hour';

ALTER TABLE "Clase" ALTER COLUMN "horario_inicio" SET NOT NULL;
ALTER TABLE "Clase" ALTER COLUMN "horario_fin" SET NOT NULL;

ALTER TABLE "Clase" DROP COLUMN "horario";
