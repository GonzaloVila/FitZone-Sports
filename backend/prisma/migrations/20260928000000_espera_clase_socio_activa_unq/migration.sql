-- M3: cierra en la base la invariante de una sola espera activa por socio.
--
-- El repository ya comprobaba con un findFirst que el socio no tuviera otra
-- espera EN_ESPERA/NOTIFICADO ni una reserva confirmada, pero esa lectura y el
-- INSERT posterior no son atomicos: dos peticiones simultaneas del mismo socio
-- para la misma clase pueden pasar ambas el chequeo y crear dos esperas.
--
-- Es el mismo esquema que ya usan unq_reserva_clase_socio_activa
-- (20260926000000_m3_espera_cancelado_unq_reserva) e
-- ingreso_usuario_abierto_unq (20260925010000): indice parcial unico en SQL
-- crudo, porque Prisma 6.19.3 no modela indices parciales. El P2002 que produce
-- el repository lo traduce a ESPERA_EXISTENTE, y el service ya lo mapea a 409.
--
-- Cubre solo los estados activos (EN_ESPERA, NOTIFICADO): un socio que dio de
-- baja y vuelve a anotarse debe poder hacerlo, igual que al CONFIRMAR queda
-- fuera por pasar a CONFIRMADO.

CREATE UNIQUE INDEX IF NOT EXISTS "unq_espera_clase_socio_activa"
  ON "EsperaClase" ("clase_id", "socio_id")
  WHERE "estado" IN ('EN_ESPERA', 'NOTIFICADO');
