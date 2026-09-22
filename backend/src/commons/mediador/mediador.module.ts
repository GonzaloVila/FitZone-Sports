import { Module } from "@nestjs/common";
import { MediadorService } from "./mediador.service";

@Module({
  providers: [MediadorService],
  exports: [MediadorService],
})
export class MediadorModule {}