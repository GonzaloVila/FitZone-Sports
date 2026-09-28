-- Rename "Socio"."sede_id" a "sede_origen_id"
--
-- "sede_id" es ambiguo en la tabla Socio: se lee como "la sede del socio",
-- pero RF-03 distingue la sede de origen (donde se dio de alta) de las sedes
-- a las que la membresia da acceso. El dominio ya usaba "sede_origen_id" y
-- el contrato tambien; la base era la unica capa que seguia con el nombre
-- corto, lo que obligaba a un mapeo manual en aDominio().
ALTER TABLE "Socio" RENAME COLUMN "sede_id" TO "sede_origen_id";

-- Postgres no renombra la constraint junto con la columna. Sin esto, el
-- constraint seguiria llamandose Socio_sede_id_fkey apuntando a la columna
-- nueva, y un "prisma migrate dev" posterior lo reportaria como drift.
ALTER TABLE "Socio" RENAME CONSTRAINT "Socio_sede_id_fkey" TO "Socio_sede_origen_id_fkey";
