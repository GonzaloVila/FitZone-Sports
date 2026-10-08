import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { EsperaIn } from '../dtos/espera-in.dto';
import { EsperaOut } from '../dtos/espera-out.dto';
import { ListarEsperaDeClaseQueryDto } from '../dtos/listar-espera-de-clase-query.dto';
import { ListarEsperasClaseQueryDto } from '../dtos/listar-esperas-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import {
  claseNoDisponibleParaEspera,
  cupoDisponible,
  cupoTomado,
  esperaConfirmada,
  esperaExistente,
  esperaNoNotificada,
  reservaDuplicadaAlConfirmar,
  socioEnMoraParaEspera,
} from '../errors/esperas.errors';
import { ClaseRepository } from '../repositories/clase.repository';
import { EsperaClaseRepository } from '../repositories/espera-clase.repository';

@Injectable()
export class EsperasClasesService {
  constructor(
    private readonly esperasRepo: EsperaClaseRepository,
    private readonly clasesRepo: ClaseRepository,
    // Antes venía por el puerto con `@Optional()` y todo el bloque de validación
    // estaba dentro de `if (this.membresias)`, así que si M1 no estaba
    // registrado el socio entraba a la lista sin comprobación. Ahora la
    // dependencia es obligatoria y RN-03 se aplica siempre.
    private readonly membresias: MembresiasService,
  ) {}

  async listarEsperaDeClase(
    claseId: number,
    filtros: ListarEsperaDeClaseQueryDto,
  ): Promise<EsperaOut[]> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    const esperas = await this.esperasRepo.listar(
      { claseId: claseId, estado: filtros.estado },
      { page: filtros.page ?? 1, perPage: filtros.perPage ?? 20 },
    );

    return plainToInstance(EsperaOut, esperas);
  }

  async listarEsperasClase(
    filtros: ListarEsperasClaseQueryDto,
  ): Promise<EsperaOut[]> {
    const esperas = await this.esperasRepo.listar(
      {
        claseId: filtros.claseId,
        socioId: filtros.socioId,
        estado: filtros.estado,
      },
      { page: filtros.page ?? 1, perPage: filtros.perPage ?? 20 },
    );

    return plainToInstance(EsperaOut, esperas);
  }

  async anotarseEnEspera(claseId: number, dto: EsperaIn): Promise<EsperaOut> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    if (new Date(clase.horario).getTime() <= Date.now()) {
      throw claseNoDisponibleParaEspera();
    }

    const estado = await this.membresias.consultarVigenciaPorSocio(dto.socioId);
    if (!estado.esSocio) {
      throw recursoNoEncontrado('El socio indicado no existe.');
    }
    if (estado.enMora || !estado.vigente) {
      throw socioEnMoraParaEspera(dto.socioId);
    }

    const resultado = await this.esperasRepo.crear({
      claseId: claseId,
      socioId: dto.socioId,
      estado: 'EN_ESPERA',
      fechaAnotacion: new Date(),
    });

    if (!resultado.ok) {
      if (resultado.motivo === 'CUPO_DISPONIBLE') {
        throw cupoDisponible(claseId, clase.cupoDisponible);
      }

      if (resultado.motivo === 'ESPERA_EXISTENTE') {
        throw esperaExistente(dto.socioId, claseId);
      }

      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    return plainToInstance(EsperaOut, resultado.espera);
  }

  async obtenerEspera(esperaId: number): Promise<EsperaOut> {
    const espera = await this.esperasRepo.buscarPorId(esperaId);
    if (!espera) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return plainToInstance(EsperaOut, espera);
  }

  async salirDeEspera(esperaId: number): Promise<void> {
    const espera = await this.esperasRepo.buscarPorId(esperaId);
    if (!espera) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }

    if (espera.estado === 'CONFIRMADO') {
      throw esperaConfirmada();
    }

    if (espera.estado === 'CANCELADO') {
      return;
    }

    await this.esperasRepo.marcarCancelada(esperaId);
  }

  async confirmarEspera(esperaId: number): Promise<ReservaClaseOut> {
    const resultado = await this.esperasRepo.confirmarEsperaConLock(esperaId);

    if (!resultado.ok) {
      if (resultado.motivo === 'ESPERA_INEXISTENTE') {
        throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
      }

      if (resultado.motivo === 'NO_NOTIFICADA') {
        throw esperaNoNotificada();
      }

      if (resultado.motivo === 'CUPO_TOMADO') {
        throw cupoTomado();
      }

      throw reservaDuplicadaAlConfirmar();
    }

    return plainToInstance(ReservaClaseOut, resultado.reserva);
  }
}
