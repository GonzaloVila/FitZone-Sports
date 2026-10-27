import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { SedesService } from '../../m2-gimnasio/services/sedes.service';
import { CanchaIn } from '../dtos/cancha-in.dto';
import { CanchaOut } from '../dtos/cancha-out.dto';
import { CanchaPatch } from '../dtos/cancha-patch.dto';
import { Cancha } from '../entities/cancha.entity';
import { canchaSinCamposParaModificar } from '../errors/canchas.errors';
import { CanchaRepository } from '../repositories/cancha.repository';

const NO_ENCONTRADO = 'No existe el recurso solicitado para el id indicado.';

@Injectable()
export class CanchasService {
  constructor(
    private readonly canchas: CanchaRepository,
    // La sede es de M2. Antes llegaba por SEDE_VALIDATION_PORT con GimnasioModule
    // en @Global(); ahora M4 importa GimnasioModule y pide `SedesService`, que es
    // la capa de negocio donde corresponde la regla de existencia.
    private readonly sedes: SedesService,
  ) {}

  async crear(sedeId: number, dto: CanchaIn): Promise<CanchaOut> {
    await this.exigirSede(sedeId);

    const cancha = await this.canchas.crear({
      sedeId: sedeId,
      tipo: dto.tipo,
      costoPorHora: dto.costoPorHora,
      estado: dto.estado ?? 'OPERATIVA',
    });
    return this.aOut(cancha);
  }

  async listar(
    sedeId: number,
    filtros: { estado?: Cancha['estado']; page: number; perPage: number },
  ): Promise<{ items: CanchaOut[]; total: number }> {
    // El contrato declara 404 tambien en el listado, no solo en el alta.
    await this.exigirSede(sedeId);

    const { items, total } = await this.canchas.listarPorSede(sedeId, filtros);
    return {
      items: items.map((cancha) => this.aOut(cancha)),
      total,
    };
  }

  // GET /canchas. A diferencia de listar(), la sede no es parte de la ruta sino un
  // filtro opcional: un sedeId inexistente da lista vacia (igual que GET /ingresos y
  // GET /socios), asi que no se consulta la existencia de la sede.
  async buscar(filtros: {
    sedeId?: number;
    tipo?: Cancha['tipo'];
    estado?: Cancha['estado'];
    page: number;
    perPage: number;
  }): Promise<{ items: CanchaOut[]; total: number }> {
    const { items, total } = await this.canchas.buscar(filtros);
    return {
      items: items.map((cancha) => this.aOut(cancha)),
      total,
    };
  }

  async obtener(id: number): Promise<CanchaOut> {
    const cancha = await this.canchas.buscarPorId(id);
    if (!cancha) {
      throw recursoNoEncontrado(NO_ENCONTRADO);
    }
    return this.aOut(cancha);
  }

  async actualizar(id: number, dto: CanchaPatch): Promise<CanchaOut> {
    // Los dos campos del PATCH son opcionales, asi que un body {} llega hasta
    // aca sin que ninguna regla del DTO lo rechace. Prisma 6 interpreta un update
    // sin campos como un no-op y devuelve la fila sin error, con lo cual la
    // respuesta era un 200 que decia "actualizado" sin haber actualizado nada.
    // El contrato declara 422 para esta operacion, asi que se corta aca.
    if (dto.costoPorHora === undefined && dto.estado === undefined) {
      throw canchaSinCamposParaModificar();
    }

    const cancha = await this.canchas.actualizar(id, {
      costoPorHora: dto.costoPorHora,
      estado: dto.estado,
    });
    if (!cancha) {
      throw recursoNoEncontrado(NO_ENCONTRADO);
    }
    return this.aOut(cancha);
  }

  private async exigirSede(sedeId: number): Promise<void> {
    if (!(await this.sedes.existe(sedeId))) {
      throw recursoNoEncontrado('No existe la sede indicada.');
    }
  }

  private aOut(cancha: Cancha): CanchaOut {
    return plainToInstance(CanchaOut, cancha);
  }
}
