// Modulo transversal (infraestructura compartida): database, mediador, filters, guards.
// Expone MediadorService (ADR-01) para que M1/M4 no acoplen M5.
import { Module } from "@nestjs/common";
import { MediadorModule } from "./mediador/mediador.module";

@Module({
  imports: [MediadorModule],
  exports: [MediadorModule],
})
export class CommonsModule {}