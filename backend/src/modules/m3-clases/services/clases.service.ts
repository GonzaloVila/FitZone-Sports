import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { SedesService } from '../../m2-gimnasio/services/sedes.service';
import { ClaseOut } from '../dtos/clase-out.dto';
import { ClaseIn } from '../dtos/clase-in.dto';
import { ListarClasesQueryDto } from '../dtos/listar-clases-query.dto';
import { claseEnHorarioPasado, horarioInvalido } from '../errors/clases.errors';
import { ClaseRepository } from '../repositories/clase.repository';

@Injectable()
export class ClasesService {
  constructor(
    private readonly clasesRepo: ClaseRepository,
    // La sede es de M2. El `@Optional()` anterior hacía que una clase se pudiera
    // crear con una sede inexistente si M2 no estaba registrado; ahora la
    // dependencia es obligatoria y la sede se valida siempre.
    private readonly sedes: SedesService,
  ) {}

  async crearClase(dto: ClaseIn): Promise<ClaseOut> {
    if (!(await this.sedes.existe(dto.sedeId))) {
      throw recursoNoEncontrado('No existe la sede indicada.');
    }

    const fechaInicio = new Date(dto.horario);
    if (isNaN(fechaInicio.getTime())) {
      throw horarioInvalido();
    }

    if (fechaInicio.getTime() <= Date.now()) {
      throw claseEnHorarioPasado();
    }

    const clase = await this.clasesRepo.crear({
      sedeId: dto.sedeId,
      tipo: dto.tipo,
      instructor: dto.instructor,
      horario: dto.horario,
      capacidad: dto.capacidad,
    });

    return plainToInstance(ClaseOut, {
      ...clase,
      reservasConfirmadas: 0,
      cupoDisponible: clase.capacidad,
    });
  }

  async listarClases(filtros: ListarClasesQueryDto): Promise<ClaseOut[]> {
    const clases = await this.clasesRepo.listar(
      {
        sedeId: filtros.sedeId,
        tipo: filtros.tipo,
      },
      { page: filtros.page ?? 1, perPage: filtros.perPage ?? 20 },
    );
    return plainToInstance(ClaseOut, clases);
  }

  async obtenerClase(claseId: number): Promise<ClaseOut> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return plainToInstance(ClaseOut, clase);
  }
}
