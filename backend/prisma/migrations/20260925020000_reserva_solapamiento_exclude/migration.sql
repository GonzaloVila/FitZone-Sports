CREATE EXTENSION IF NOT EXISTS btree_gist;

-- RN-02 / RF-10: el horario queda bloqueado para el resto. Un unique
-- parcial sobre (cancha_id, fecha_hora_inicio) solo detectaba colision
-- exacta y dejaba pasar el solapamiento (18:00-19:30 / 18:30-19:30).
-- La constraint de exclusion cubre ambos casos desde la base.
--
-- tsrange y NO tstzrange: las columnas son TIMESTAMP(3) sin zona, y con
-- tstzrange PostgreSQL castearia usando el TimeZone de cada sesion.
-- Prisma no modela EXCLUDE ni indices parciales: esto va como SQL crudo.

DROP INDEX IF EXISTS unq_reserva_turno;
ALTER TABLE "Reserva" ADD CONSTRAINT exq_reserva_turno
  EXCLUDE USING gist (
    "cancha_id" WITH =,
    tsrange("fecha_hora_inicio", "fecha_hora_fin") WITH &&
  )
  WHERE ("estado" <> 'CANCELADA');
