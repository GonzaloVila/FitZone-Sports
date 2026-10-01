// CAPAS - M2 Gimnasio y Acceso (RF-04, RF-05).
// Igual estructura que m1 (controllers/services/repositories/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { IngresosController } from './controllers/ingresos.controller';
import { SedesController } from './controllers/sedes.controller';
import { IngresoRepository } from './repositories/ingreso.repository';
import { SedeRepository } from './repositories/sede.repository';
import { IngresosService } from './services/ingresos.service';
import { SedesService } from './services/sedes.service';

// M2 depende de M1 (RN-03 al validar el ingreso) y M4 depende de M2 (existencia
// de la sede al crear una cancha). El grafo es aciclico: M1 -> nada, M2 -> M1,
// M3 -> M1, M4 -> M1 + M2, y M5 -> M1 + M4.
@Module({
  // M2 importa M1 explicitamente por `MembresiasService`, que es lo unico que
  // necesita de ahi (RN-03 al validar el ingreso). No ve los repositorios de M1:
  // esos son privados de su modulo.
  imports: [CommonsModule, UsuariosModule],
  controllers: [SedesController, IngresosController],
  providers: [
    SedeRepository,
    IngresoRepository,
    SedesService,
    IngresosService,
  ],
  // Sale unicamente `SedesService`: es lo que M4 necesita para validar que la sede
  // de una cancha exista. Los repositorios quedan privados de M2.
  exports: [SedesService],
})
export class GimnasioModule {}
