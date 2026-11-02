import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { ClaseIn } from '../dtos/clase-in.dto';
import { ClaseOut } from '../dtos/clase-out.dto';
import { EsperaIn } from '../dtos/espera-in.dto';
import { EsperaOut } from '../dtos/espera-out.dto';
import { ListarEsperasClaseQueryDto } from '../dtos/listar-esperas-clase-query.dto';
import { ListarReservasClaseQueryDto } from '../dtos/listar-reservas-clase-query.dto';
import { ReservaClaseIn } from '../dtos/reserva-clase-in.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import {
  esSocio,
  exigirDelSocioPropio,
  exigirSedeDeLaClase,
  exigirSocioDelAlta,
  socioDelListado,
} from './alcance-clases';
import { ClasesService } from './clases.service';
import { EsperasClasesService } from './esperas-clases.service';
import { ReservasClasesService } from './reservas-clases.service';

/**
 * Lo que los controllers de M3 le piden a sus servicios en nombre de una persona con sesion: aplica el alcance por rol
 * (`alcance-clases.ts`) y delega, sin que los servicios sepan de quien llama. Las lecturas que son de cualquier socio o del
 * personal (clases, inscriptos, cola de espera) no pasan por aca: solo las acota @Roles. El cobro de la penalidad, los
 * observers de cupo liberado y el resto de los flujos internos usan los servicios directo.
 */
@Injectable()
export class ClasesAccesoService {
  constructor(
    private readonly clases: ClasesService,
    private readonly reservas: ReservasClasesService,
    private readonly esperas: EsperasClasesService,
  ) {}

  async crearClase(actor: UsuarioAutenticado, dto: ClaseIn): Promise<ClaseOut> {
    exigirSedeDeLaClase(actor, dto.sedeId);
    return this.clases.crearClase(dto);
  }

  // ---- Reservas de clase ----

  async crearReserva(actor: UsuarioAutenticado, dto: ReservaClaseIn): Promise<ReservaClaseOut> {
    exigirSocioDelAlta(actor, dto.socioId);
    return this.reservas.crearReservaClase(dto.claseId, dto);
  }

  async listarReservas(
    actor: UsuarioAutenticado,
    query: ListarReservasClaseQueryDto,
  ): ReturnType<ReservasClasesService['listarReservasClase']> {
    return this.reservas.listarReservasClase({ ...query, socioId: socioDelListado(actor, query.socioId) });
  }

  async obtenerReserva(actor: UsuarioAutenticado, id: number): Promise<ReservaClaseOut> {
    const reserva = await this.reservas.obtenerReservaClase(id);
    exigirDelSocioPropio(actor, reserva.socioId);
    return reserva;
  }

  async cancelarReserva(actor: UsuarioAutenticado, id: number): Promise<void> {
    // RECEPCION y GERENTE cancelan cualquiera: no hace falta leer antes (si no existe, cancelar responde el 404).
    if (esSocio(actor)) {
      await this.obtenerReserva(actor, id);
    }
    return this.reservas.cancelarReservaClase(id);
  }

  // ---- Esperas ----

  async anotarse(actor: UsuarioAutenticado, claseId: number, dto: EsperaIn): Promise<EsperaOut> {
    exigirSocioDelAlta(actor, dto.socioId);
    return this.esperas.anotarseEnEspera(claseId, dto);
  }

  async listarEsperas(
    actor: UsuarioAutenticado,
    query: ListarEsperasClaseQueryDto,
  ): ReturnType<EsperasClasesService['listarEsperasClase']> {
    return this.esperas.listarEsperasClase({ ...query, socioId: socioDelListado(actor, query.socioId) });
  }

  async obtenerEspera(actor: UsuarioAutenticado, id: number): Promise<EsperaOut> {
    const espera = await this.esperas.obtenerEspera(id);
    exigirDelSocioPropio(actor, espera.socioId);
    return espera;
  }

  async salirDeEspera(actor: UsuarioAutenticado, id: number): Promise<void> {
    if (esSocio(actor)) {
      await this.obtenerEspera(actor, id);
    }
    return this.esperas.salirDeEspera(id);
  }

  async confirmarEspera(actor: UsuarioAutenticado, id: number): Promise<ReservaClaseOut> {
    if (esSocio(actor)) {
      await this.obtenerEspera(actor, id);
    }
    return this.esperas.confirmarEspera(id);
  }
}
