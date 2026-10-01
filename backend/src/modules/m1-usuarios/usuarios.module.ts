import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonsModule } from '../../commons/commons.module';
import { MembresiasController } from './controllers/membresias.controller';
import { SociosController } from './controllers/socios.controller';
import { UsuariosController } from './controllers/usuarios.controller';
import { MembresiasCron } from './crons/membresias.cron';
import { MembresiaRepository } from './repositories/membresia.repository';
import { SocioRepository } from './repositories/socio.repository';
import { UsuarioRepository } from './repositories/usuario.repository';
import { MembresiasService } from './services/membresias.service';
import { SociosService } from './services/socios.service';
import { UsuariosService } from './services/usuarios.service';

// M1 es la raiz del grafo de modulos: no importa ningun modulo de dominio, solo
// `CommonsModule` y el scheduler. Quien necesite Membership (M2, M3, M4) importa
// este modulo y recibe `MembresiasService`; quien necesite el email de un socio
// (el observer de M3) recibe `SociosService`. No hace falta @Global() porque el
// grafo ya es aciclico y cada modulo declara lo que usa.
@Module({
  imports: [CommonsModule, ScheduleModule.forRoot()],
  controllers: [UsuariosController, SociosController, MembresiasController],
  providers: [
    UsuarioRepository,
    SocioRepository,
    MembresiaRepository,
    UsuariosService,
    SociosService,
    MembresiasService,
    MembresiasCron,
  ],
  // Los repositorios quedan privados a proposito: la capa de acceso a datos de M1
  // no se consume desde afuera, solo lo que hay arriba en la capa de negocio.
  exports: [MembresiasService, SociosService],
})
export class UsuariosModule {}
