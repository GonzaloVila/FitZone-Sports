import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { GimnasioModule } from '../m2-gimnasio/gimnasio.module';
import { ClasesController } from './controllers/clases.controller';
import { EsperasClasesController } from './controllers/esperas-clases.controller';
import { ReservasClasesController } from './controllers/reservas-clases.controller';
import { EmailCupoLiberadoObserver } from './observers/email-cupo-liberado.observer';
import { NotificarSociosEsperaObserver } from './observers/notificar-socios-espera.observer';
import { ClaseRepository } from './repositories/clase.repository';
import { EsperaClaseRepository } from './repositories/espera-clase.repository';
import { ReservaClaseRepository } from './repositories/reserva-clase.repository';
import { ClasesService } from './services/clases.service';
import { EsperasClasesService } from './services/esperas-clases.service';
import { ReservaClasePrecioService } from './services/reserva-clase-precio.service';
import { ReservasClasesService } from './services/reservas-clases.service';
import { ClaseExiste } from './validaciones/clase-existe.validacion';
import { ClaseNoComenzada } from './validaciones/clase-no-comenzada.validacion';
import { ReservaAnticipada } from './validaciones/reserva-anticipada.validacion';
import { SocioAlDia } from './validaciones/socio-al-dia.validacion';
import { VALIDACIONES_RESERVA } from './validaciones/validacion-de-reserva';
import { ValidadorDeReservas } from './validaciones/validador-de-reservas';

// M3 depende de M1 (RN-03 en reservas y esperas, y el email del observer de cupo
// liberado) y de M2 (la sede de una clase nueva debe existir). Exporta UNA sola
// cosa, `ReservaClasePrecioService`, para que M5 resuelva el importe de la
// penalidad por cancelacion tardia (RF-07) sin exponer el resto de M3 (la cola
// de espera, el cupo o la alta de clases no le sirven a nadie).
@Module({
  imports: [CommonsModule, UsuariosModule, GimnasioModule],
  controllers: [
    ClasesController,
    ReservasClasesController,
    EsperasClasesController,
  ],
  providers: [
    ClaseRepository,
    ReservaClaseRepository,
    EsperaClaseRepository,
    ClasesService,
    ReservasClasesService,
    EsperasClasesService,
    ReservaClasePrecioService,
    // Observers de cupo liberado (RF-08): son oyentes del bus (`@OnEvent`), no se
    // registran a mano en ningun Subject.
    NotificarSociosEsperaObserver,
    EmailCupoLiberadoObserver,
    // Cadena de validaciones de la reserva de clase (ADR-10, Chain of Responsibility).
    // El orden lo fija el contenedor vía `useFactory`: [clase existe, socio al día,
    // no anticipada, no comenzada].
    ClaseExiste,
    SocioAlDia,
    ReservaAnticipada,
    ClaseNoComenzada,
    {
      provide: VALIDACIONES_RESERVA,
      useFactory: (
        claseExiste: ClaseExiste,
        socioAlDia: SocioAlDia,
        anticipada: ReservaAnticipada,
        noComenzada: ClaseNoComenzada,
      ) => [claseExiste, socioAlDia, anticipada, noComenzada],
      inject: [ClaseExiste, SocioAlDia, ReservaAnticipada, ClaseNoComenzada],
    },
    ValidadorDeReservas,
  ],
  exports: [ReservaClasePrecioService],
})
export class ClasesModule {}
