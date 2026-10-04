import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  GENERIC_TYPE,
  ProblemException,
  TITLES,
  recursoNoEncontrado,
} from '../../../commons/filters/problem.exception';
import { plainToInstance } from 'class-transformer';
import { EVENTO_MEMBRESIA_PLAN } from '../../../commons/eventos';
import { MembresiaOut } from '../dtos/membresia-out.dto';
import { MembresiaPatch } from '../dtos/membresia-patch.dto';
import { PRECIOS_PLAN, estaVigente } from '../entities/membresia.entity';
import type {
  EstadoSocioMembresia,
  Membresia,
  MembresiaNoVigente,
  MembresiaRenovable,
  VigenciaMembresia,
} from '../entities/membresia.entity';
import { MembresiaRepository } from '../repositories/membresia.repository';
import { SocioRepository } from '../repositories/socio.repository';

@Injectable()
export class MembresiasService {
  constructor(
    private readonly membresias: MembresiaRepository,
    private readonly socios: SocioRepository,
    // Global y sincrono: para avisar a M5 que hay que cobrar un cambio de plan
    // sobre una membresia no vigente. M1 no importa a M5 (grafo M5 -> M1).
    private readonly eventos: EventEmitter2,
  ) {}

  async obtenerPorSocioId(socioId: number): Promise<MembresiaOut> {
    const socio = await this.socios.buscarPorId(socioId);
    if (!socio) {
      throw recursoNoEncontrado('No existe el socio indicado.');
    }

    const membresia = await this.membresias.buscarPorSocioId(socioId);
    if (!membresia) {
      throw recursoNoEncontrado('El socio no posee una membresía activa.');
    }

    return this.aOut(membresia);
  }

  async modificar(socioId: number, dto: MembresiaPatch): Promise<MembresiaOut> {
    const socio = await this.socios.buscarPorId(socioId);
    if (!socio) {
      throw recursoNoEncontrado('No existe el socio indicado.');
    }

    // Los tres campos del PATCH son opcionales, asi que con body {} pasa entero
    // hasta el repositorio, que arma el data asignando los tres sin condicion.
    // Prisma 6 interpreta un update sin campos como un no-op y devuelve la fila
    // sin error: la respuesta era un 200 que decia "actualizado" sin haber
    // actualizado nada. El contrato declara 422 para esta operacion, asi que se
    // corta aca.
    if (dto.plan === undefined && dto.renueva_automatica === undefined && dto.estado === undefined) {
      throw new ProblemException({
        type: GENERIC_TYPE,
        title: TITLES[HttpStatus.UNPROCESSABLE_ENTITY],
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'Se debe enviar al menos un campo para modificar.',
      });
    }

    // Cambio de plan sobre una membresia NO vigente (RF-02). El socio quiere
    // pasarse a otro plan cuando el actual ya vencio (o esta suspendida): se
    // cobra el plan NUEVO y recien si la pasarela aprueba se modifica la fila.
    // Si era vigente, es solo un cambio de plan, sin cobro (decision del equipo).
    // `emitAsync` es sincrono: si el listener de M5 lanza (cobro rechazado), el
    // error se propaga aca como 402 y el update nunca corre.
    if (dto.plan !== undefined) {
      const previa = await this.membresias.buscarPorSocioId(socioId);
      if (previa && !estaVigente(previa)) {
        await this.eventos.emitAsync(EVENTO_MEMBRESIA_PLAN, {
          membresia_id: previa.id,
          usuario_id: socio.usuario_id,
          precio: PRECIOS_PLAN[dto.plan],
          plan: dto.plan,
        });
      }
    }

    const membresia = await this.membresias.actualizar(socioId, dto);
    if (!membresia) {
      throw recursoNoEncontrado('El socio no posee una membresía activa.');
    }

    return this.aOut(membresia);
  }

  // Las dos consultas de vigencia vivian en el adapter
  // `MembresiaValidationAdapter` que se elimino con el puerto. Son la puerta de
  // entrada de M2, M3 y M4 a la regla de membresia (RF-03, RN-03), asi que la
  // regla se queda aqui, en el unico lugar que tiene los dos repositorios.
  async consultarVigencia(usuarioId: number): Promise<VigenciaMembresia> {
    const socio = await this.socios.buscarPorUsuarioId(usuarioId);
    if (!socio) {
      return { vigente: false };
    }

    const membresia = await this.membresias.buscarPorSocioId(socio.id);
    if (!membresia) {
      return { vigente: false };
    }

    return { vigente: estaVigente(membresia) };
  }

  // RN-03: un socio sin membresia esta en mora por definicion, y tambien esta
  // en mora la que tiene una membresia vencida o suspendida.
  async consultarVigenciaPorSocio(socioId: number): Promise<EstadoSocioMembresia> {
    const socio = await this.socios.buscarPorId(socioId);
    if (!socio) {
      return { esSocio: false, vigente: false, enMora: false };
    }

    const membresia = await this.membresias.buscarPorSocioId(socio.id);
    if (!membresia) {
      return { esSocio: true, vigente: false, enMora: true };
    }

    const vigente = estaVigente(membresia);
    const enMora =
      !vigente || membresia.estado === 'VENCIDA' || membresia.estado === 'SUSPENDIDA';
    return {
      esSocio: true,
      vigente,
      enMora,
    };
  }

  // GET /bloqueados (Fase 4, RF-04/Unidad III). El motivo exacto del 403 de
  // una sede offline: cualquier no-vigente desde `desde`, para que el puesto
  // sincronice su lista local sin traer el historico completo cada vez.
  async buscarNoVigentes(desde: Date): Promise<MembresiaNoVigente[]> {
    return this.membresias.buscarNoVigentes(desde);
  }

  // RF-02 (renovacion automatica, cron de M5): las membresias vencidas con
  // renovacion automatica habilitada. M5 cobra y, si aprobo, llama a `renovar`.
  async listarRenovables(ahora: Date): Promise<MembresiaRenovable[]> {
    return this.membresias.listarRenovables(ahora);
  }

  // RF-02: extiende el periodo de una membresia renovada. El periodo contiguo lo
  // calcula el llamador (M5) con `calcularVigencia(plan, fecha_fin_previo)`.
  async renovar(id: number, periodo: { fecha_inicio: Date; fecha_fin: Date }): Promise<MembresiaOut> {
    const membresia = await this.membresias.renovar(id, periodo);
    if (!membresia) {
      throw recursoNoEncontrado('No existe la membresía indicada.');
    }
    return this.aOut(membresia);
  }

  private aOut(membresia: Membresia): MembresiaOut {
    return plainToInstance(MembresiaOut, membresia);
  }
}
