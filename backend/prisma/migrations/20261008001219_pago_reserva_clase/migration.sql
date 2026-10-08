-- CreateTable
CREATE TABLE "PagoReservaClase" (
    "id_pago" INTEGER NOT NULL,
    "reserva_clase_id" INTEGER NOT NULL,

    CONSTRAINT "PagoReservaClase_pkey" PRIMARY KEY ("id_pago")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagoReservaClase_reserva_clase_id_key" ON "PagoReservaClase"("reserva_clase_id");

-- AddForeignKey
ALTER TABLE "PagoReservaClase" ADD CONSTRAINT "PagoReservaClase_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "Pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoReservaClase" ADD CONSTRAINT "PagoReservaClase_reserva_clase_id_fkey" FOREIGN KEY ("reserva_clase_id") REFERENCES "ReservaClase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;