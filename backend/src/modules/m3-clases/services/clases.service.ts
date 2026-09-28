import {
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ProblemException, recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import {
  SEDE_VALIDATION_PORT,
  type SedeValidationPort,
} from '../../../commons/sede/sede-validation.port';
import { ClaseOutDto } from '../dtos/clase-out.dto';
import { CrearClaseDto } from '../dtos/crear-clase.dto';
import { ListarClasesQueryDto } from '../dtos/listar-clases-query.dto';
import {
  CLASE_REPOSITORY,
  type ClaseRepository,
} from '../repositories/clase.repository';

@Injectable()
export class ClasesService {
  constructor(
    @Inject(CLASE_REPOSITORY)
    private readonly clasesRepo: ClaseRepository,
    @Optional()
    @Inject(SEDE_VALIDATION_PORT)
    private readonly sedeValidation: SedeValidationPort | null,
  ) {}

  async crearClase(dto: CrearClaseDto): Promise<ClaseOutDto> {
    if (this.sedeValidation) {
      const existeSede = await this.sedeValidation.existeSede(dto.sede_id);
      if (!existeSede) {
        throw recursoNoEncontrado('No existe la sede indicada.');
      }
    }

    const fechaInicio = new Date(dto.horario);
    if (isNaN(fechaInicio.getTime())) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/fecha-invalida',
        title: 'Horario inválido',
        status: HttpStatus.CONFLICT,
        detail: 'El formato de fecha y hora no corresponde a un ISO-8601 válido.',
      });
    }

    if (fechaInicio.getTime() <= Date.now()) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/clase-pasada',
        title: 'Clase en horario pasado',
        status: HttpStatus.CONFLICT,
        detail: 'No se puede programar una clase en una fecha u hora pasada.',
      });
    }

    const clase = await this.clasesRepo.crear({
      sede_id: dto.sede_id,
      tipo: dto.tipo,
      instructor: dto.instructor,
      horario: dto.horario,
      capacidad: dto.capacidad,
    });

    return plainToInstance(ClaseOutDto, {
      ...clase,
      reservas_confirmadas: 0,
      cupo_disponible: clase.capacidad,
    });
  }

  async listarClases(filtros: ListarClasesQueryDto): Promise<ClaseOutDto[]> {
    const clases = await this.clasesRepo.listar(
      {
        sede_id: filtros.sede_id,
        tipo: filtros.tipo,
      },
      { page: filtros.page ?? 1, perPage: filtros.per_page ?? 20 },
    );
    return plainToInstance(ClaseOutDto, clases);
  }

  async obtenerClase(claseId: number): Promise<ClaseOutDto> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return plainToInstance(ClaseOutDto, clase);
  }
}
