-- M3/M4: hace honesto el tipo de las fechas.
--
-- Las once columnas de fecha eran TIMESTAMP(3) sin zona. Prisma mapea DateTime a
-- timestamp(3) y escribe los componentes UTC del instante, asi que lo
-- almacenado era wall-clock UTC en una columna que declara no tener zona. Nada
-- lo declaraba ni lo forzaba: no hay SET TIME ZONE en las migraciones, ni TZ en
-- la configuracion, y produccion (Supabase en sa-east-1) y los tests (Postgres
-- local) son dos entornos distintos confiando en el mismo default no declarado.
--
-- Eso ya habia forzado una decision: 20260925020000_reserva_solapamiento_exclude
-- uso tsrange y NO tstzrange precisamente porque las columnas no tenian zona, y
-- su comentario admite que con tstzrange PostgreSQL castearia usando el TimeZone
-- de cada sesion. O sea, la invariante RN-02 (no solapamiento) depende hoy de
-- que toda sesion escriba UTC, y eso vive en un comentario, no en el esquema.
--
-- Con TIMESTAMPTZ el tipo pasa a declarar lo que los datos ya eran, y tstzrange
-- pasa a ser correcto por construccion: los rangos se comparan por instante
-- absoluto y no dependen del TimeZone de quien consulta.
--
-- El SET TIME ZONE 'UTC' es lo que hace la conversion neutra. ALTER ... TYPE
-- interpreta los valores existentes con el TimeZone de la sesion en curso; como
-- lo almacenado es wall-clock UTC, fijar UTC antes del ALTER deja los instantes
-- intactos. Sin esta linea, los instantes se correrian en el offset de la sesion
-- que ejecutara la migracion. Verificado contra fitzone_tstz_probe: los ocho
-- instantes de muestra se leen identicos antes y despues.
--
-- No se puede hacer en un solo ALTER sobre Reserva: exq_reserva_turno esta
-- construida con tsrange sobre esas columnas, y el indice tiene que caer primero.

SET TIME ZONE 'UTC';

-- 1. Libera la constraint de exclusion antes de tocar las columnas.
--    Con TIMESTAMPTZ el rango pasa a ser tstzrange, que compara instantes
--    absolutos en vez de wall-clock, y el WHERE de estado no cambia.
ALTER TABLE "Reserva" DROP CONSTRAINT IF EXISTS exq_reserva_turno;

-- 2. timestamp(3) without time zone -> timestamptz(3)
ALTER TABLE "Socio"
  ALTER COLUMN "fecha_alta" TYPE timestamptz(3) USING "fecha_alta"::timestamptz;

ALTER TABLE "Membresia"
  ALTER COLUMN "fecha_inicio" TYPE timestamptz(3) USING "fecha_inicio"::timestamptz,
  ALTER COLUMN "fecha_fin"    TYPE timestamptz(3) USING "fecha_fin"::timestamptz;

ALTER TABLE "Reserva"
  ALTER COLUMN "fecha_hora_inicio" TYPE timestamptz(3) USING "fecha_hora_inicio"::timestamptz,
  ALTER COLUMN "fecha_hora_fin"    TYPE timestamptz(3) USING "fecha_hora_fin"::timestamptz;

ALTER TABLE "EsperaClase"
  ALTER COLUMN "fecha_anotacion"    TYPE timestamptz(3) USING "fecha_anotacion"::timestamptz,
  ALTER COLUMN "fecha_notificacion" TYPE timestamptz(3) USING "fecha_notificacion"::timestamptz,
  ALTER COLUMN "fecha_confirmacion" TYPE timestamptz(3) USING "fecha_confirmacion"::timestamptz;

ALTER TABLE "Ingreso"
  ALTER COLUMN "fecha_hora_ingreso" TYPE timestamptz(3) USING "fecha_hora_ingreso"::timestamptz,
  ALTER COLUMN "fecha_hora_egreso"  TYPE timestamptz(3) USING "fecha_hora_egreso"::timestamptz;

ALTER TABLE "Pago"
  ALTER COLUMN "fecha_pago" TYPE timestamptz(3) USING "fecha_pago"::timestamptz;

-- 3. RN-02 / RF-10 sobre Timestamptz: mismo alcance que en
--    20260925020000, ahora comparando instantes y no wall-clock.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reserva" ADD CONSTRAINT exq_reserva_turno
  EXCLUDE USING gist (
    "cancha_id" WITH =,
    tstzrange("fecha_hora_inicio", "fecha_hora_fin") WITH &&
  )
  WHERE ("estado" <> 'CANCELADA');
