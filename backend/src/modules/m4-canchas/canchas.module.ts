// CAPAS - M4 Canchas Deportivas. Igual estructura que m2
// (controllers/services/repositories/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { GimnasioModule } from '../m2-gimnasio/gimnasio.module';
import { CanchasController } from './controllers/canchas.controller';
import { ReservasCanchasController } from './controllers/reservas-canchas.controller';
import { ReservaRepository } from './domain/reserva.port';
import { DescuentoSocio } from './pricing/descuento-socio.regla';
import { RecargoHorarioPico } from './pricing/recargo-horario-pico.regla';
import { REGLAS_DE_PRECIO } from './pricing/regla-de-precio';
import { TarifadorDePrecios } from './pricing/tarifador-de-precios';
import { CanchaRepository } from './repositories/cancha.repository';
import { PrismaReservaRepository } from './repositories/reserva.repository';
import { CanchasService } from './services/canchas.service';
import { DisponibilidadService } from './services/disponibilidad.service';
import { ReservasCanchasService } from './services/reservas-canchas.service';
import { ReservaPrecioService } from './services/reserva-precio.service';
import { CanchaExiste } from './validaciones/cancha-existe.validacion';
import { CanchaOperativa } from './validaciones/cancha-operativa.validacion';
import { RangoHorarioValido } from './validaciones/rango-horario-valido.validacion';
import { TurnoNoPasado } from './validaciones/turno-no-pasado.validacion';
import { VALIDACIONES_RESERVA_CANCHA } from './validaciones/validacion-de-reserva-cancha';
import { ValidadorDeReservasCancha } from './validaciones/validador-de-reservas-cancha';

// M4 depende de M1 (RN-03 al cotizar la tarifa bonificada) y de M2 (la sede de una
// cancha nueva debe existir). Exporta UNA sola cosa, `ReservaPrecioService`, para que
// M5 lea el precio congelado de una reserva por su propio caso de uso y no necesite
// los services de canchas: por eso existe un service aparte y no se exporta
// `ReservasCanchasService` entero, que ademas le abriria la puerta a crear y cancelar
// reservas desde M5.
@Module({
  imports: [CommonsModule, UsuariosModule, GimnasioModule],
  controllers: [CanchasController, ReservasCanchasController],
  providers: [
    CanchaRepository,
    // Puerto de dominio (Fowler) con su adaptador de Prisma: unica excepcion, junto
    // con MembresiaRepository de M1, a "repositorio = clase concreta".
    { provide: ReservaRepository, useClass: PrismaReservaRepository },
    CanchasService,
    DisponibilidadService,
    ReservasCanchasService,
    ReservaPrecioService,
    // Precio dinamico (RF-11, ADR-06): las reglas se registran como providers y el
    // `useFactory` arma la coleccion ORDENADA (el @Order de Spring). El Tarifador la
    // recibe por DI y no conoce ninguna regla concreta. Orden: [descuentoSocio, pico].
    DescuentoSocio,
    RecargoHorarioPico,
    {
      provide: REGLAS_DE_PRECIO,
      useFactory: (descuento: DescuentoSocio, pico: RecargoHorarioPico) => [descuento, pico],
      inject: [DescuentoSocio, RecargoHorarioPico],
    },
    TarifadorDePrecios,
    // Cadena de validaciones de la reserva de cancha (ADR-10, Chain of Responsibility).
    // Orden: [cancha existe, cancha operativa, rango horario válido, turno no pasado].
    CanchaExiste,
    CanchaOperativa,
    RangoHorarioValido,
    TurnoNoPasado,
    {
      provide: VALIDACIONES_RESERVA_CANCHA,
      useFactory: (
        canchaExiste: CanchaExiste,
        operativa: CanchaOperativa,
        rango: RangoHorarioValido,
        noPasado: TurnoNoPasado,
      ) => [canchaExiste, operativa, rango, noPasado],
      inject: [CanchaExiste, CanchaOperativa, RangoHorarioValido, TurnoNoPasado],
    },
    ValidadorDeReservasCancha,
  ],
  exports: [ReservaPrecioService],
})
export class CanchasModule {}
