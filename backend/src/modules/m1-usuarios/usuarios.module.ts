import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonsModule } from '../../commons/commons.module';
import { BloqueadosController } from './controllers/bloqueados.controller';
import { MembresiasController } from './controllers/membresias.controller';
import { SociosController } from './controllers/socios.controller';
import { UsuariosController } from './controllers/usuarios.controller';
import { MembresiasCron } from './crons/membresias.cron';
import { MembresiaRepository } from './domain/membresia.port';
import { EmpleadoSedeRepository } from './repositories/empleado-sede.repository';
import { PrismaMembresiaRepository } from './repositories/membresia.repository';
import { SocioRepository } from './repositories/socio.repository';
import { UsuarioRepository } from './repositories/usuario.repository';
import { MembresiasService } from './services/membresias.service';
import { MembresiaPrecioService } from './services/membresia-precio.service';
import { SociosService } from './services/socios.service';
import { UsuariosService } from './services/usuarios.service';

// M1 es la raíz del grafo de módulos: no importa ningún módulo de dominio, solo
// `CommonsModule` y el scheduler. Quien necesite Membership (M2, M3, M4) importa
// este módulo y recibe `MembresiasService`; quien necesite el email de un socio
// (el observer de M3) recibe `SociosService`; M5 recibe `MembresiaPrecioService`
// para leer el precio congelado de una membresía sin escribir consultas sobre esta
// tabla (ADR-07). No hace falta @Global() porque el grafo ya es acíclico y cada
// módulo declara lo que usa.
//
// UsuariosService se agrega a exports para AuthModule (login): necesita
// buscarParaAutenticar(), que vive ahí porque es el único service con acceso
// a la vez a UsuarioRepository y a EmpleadoSedeRepository (sedeId del JWT
// de un RECEPCION). Los dos repositorios siguen privados.
@Module({
  imports: [CommonsModule, ScheduleModule.forRoot()],
  controllers: [UsuariosController, SociosController, MembresiasController, BloqueadosController],
  providers: [
    UsuarioRepository,
    SocioRepository,
    // Puerto de dominio (Fowler) con su adaptador de Prisma: unica excepcion, junto
    // con ReservaRepository de M4, a "repositorio = clase concreta".
    { provide: MembresiaRepository, useClass: PrismaMembresiaRepository },
    EmpleadoSedeRepository,
    UsuariosService,
    SociosService,
    MembresiasService,
    MembresiaPrecioService,
    MembresiasCron,
  ],
  // Los repositorios quedan privados a propósito: la capa de acceso a datos de M1
  // no se consume desde afuera, solo lo que hay arriba en la capa de negocio.
exports: [MembresiasService, SociosService, MembresiaPrecioService, UsuariosService],
})
export class UsuariosModule {}
