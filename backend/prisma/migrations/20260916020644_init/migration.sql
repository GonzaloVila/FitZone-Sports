-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SOCIO', 'EXTERNO', 'RECEPCION', 'GERENTE');

-- CreateEnum
CREATE TYPE "PlanMembresia" AS ENUM ('MENSUAL', 'TRIMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "EstadoMembresia" AS ENUM ('ACTIVA', 'VENCIDA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "TipoCancha" AS ENUM ('PADDLE', 'FUTBOL5');

-- CreateEnum
CREATE TYPE "EstadoCancha" AS ENUM ('OPERATIVA', 'EN_MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoReservaClase" AS ENUM ('CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoEspera" AS ENUM ('EN_ESPERA', 'NOTIFICADO', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO');

-- CreateTable
CREATE TABLE "Sede" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "aforo_maximo" INTEGER NOT NULL,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "rol" "Rol" NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contrasenia" TEXT NOT NULL,
    "telefono" TEXT,
    "foto_url" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoSede" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "sede_id" INTEGER NOT NULL,

    CONSTRAINT "EmpleadoSede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Socio" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "sede_id" INTEGER NOT NULL,
    "fecha_alta" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membresia" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "plan" "PlanMembresia" NOT NULL,
    "estado" "EstadoMembresia" NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "renueva_automatica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Membresia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cancha" (
    "id" SERIAL NOT NULL,
    "sede_id" INTEGER NOT NULL,
    "tipo" "TipoCancha" NOT NULL,
    "costo_por_hora" DECIMAL(65,30) NOT NULL,
    "estado" "EstadoCancha" NOT NULL,

    CONSTRAINT "Cancha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clase" (
    "id" SERIAL NOT NULL,
    "sede_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "instructor" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL,

    CONSTRAINT "Clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" SERIAL NOT NULL,
    "cancha_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_hora_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_hora_fin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoReserva" NOT NULL,
    "precio_aplicado" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaClase" (
    "id" SERIAL NOT NULL,
    "clase_id" INTEGER NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "estado" "EstadoReservaClase" NOT NULL,

    CONSTRAINT "ReservaClase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsperaClase" (
    "id" SERIAL NOT NULL,
    "clase_id" INTEGER NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "estado" "EstadoEspera" NOT NULL,
    "fecha_anotacion" TIMESTAMP(3) NOT NULL,
    "fecha_notificacion" TIMESTAMP(3),
    "fecha_confirmacion" TIMESTAMP(3),

    CONSTRAINT "EsperaClase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "idempotencia_key" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "estado" "EstadoPago" NOT NULL,
    "token" TEXT NOT NULL,
    "comprobante_pdf_url" TEXT,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoReserva" (
    "id_pago" INTEGER NOT NULL,
    "reserva_id" INTEGER NOT NULL,

    CONSTRAINT "PagoReserva_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "PagoMembresia" (
    "id_pago" INTEGER NOT NULL,
    "membresia_id" INTEGER NOT NULL,

    CONSTRAINT "PagoMembresia_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "Ingreso" (
    "id" SERIAL NOT NULL,
    "sede_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_hora_ingreso" TIMESTAMP(3) NOT NULL,
    "fecha_hora_egreso" TIMESTAMP(3),

    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_dni_key" ON "Usuario"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmpleadoSede_usuario_id_key" ON "EmpleadoSede"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "EmpleadoSede_sede_id_key" ON "EmpleadoSede"("sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_usuario_id_key" ON "Socio"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "Membresia_socio_id_key" ON "Membresia"("socio_id");

-- CreateIndex
CREATE INDEX "Reserva_cancha_id_fecha_hora_inicio_idx" ON "Reserva"("cancha_id", "fecha_hora_inicio");

-- CreateIndex
CREATE UNIQUE INDEX unq_reserva_turno ON "Reserva"("cancha_id", "fecha_hora_inicio") WHERE "estado" <> 'CANCELADA';

-- CreateIndex
CREATE UNIQUE INDEX "Pago_idempotencia_key_key" ON "Pago"("idempotencia_key");

-- CreateIndex
CREATE UNIQUE INDEX "PagoReserva_reserva_id_key" ON "PagoReserva"("reserva_id");

-- AddForeignKey
ALTER TABLE "EmpleadoSede" ADD CONSTRAINT "EmpleadoSede_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoSede" ADD CONSTRAINT "EmpleadoSede_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Socio" ADD CONSTRAINT "Socio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Socio" ADD CONSTRAINT "Socio_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancha" ADD CONSTRAINT "Cancha_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "Cancha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaClase" ADD CONSTRAINT "ReservaClase_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "Clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaClase" ADD CONSTRAINT "ReservaClase_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsperaClase" ADD CONSTRAINT "EsperaClase_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "Clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsperaClase" ADD CONSTRAINT "EsperaClase_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoReserva" ADD CONSTRAINT "PagoReserva_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "Pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoReserva" ADD CONSTRAINT "PagoReserva_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoMembresia" ADD CONSTRAINT "PagoMembresia_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "Pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoMembresia" ADD CONSTRAINT "PagoMembresia_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "Membresia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingreso" ADD CONSTRAINT "Ingreso_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingreso" ADD CONSTRAINT "Ingreso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
