import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../commons/database/prisma.service';

export interface EmpleadoSede {
  id: number;
  usuarioId: number;
  sedeId: number;
}

// Capa de acceso a datos del staff de sucursal (rol RECEPCION, A3). Lo usan
// AuthService (sedeId del JWT al loguear) y UsuariosService (alta con sede).
// No hay endpoint propio de EmpleadoSede: la fila nace en POST /usuarios y,
// por decision de alcance, no se reasigna despues por API.
@Injectable()
export class EmpleadoSedeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorUsuarioId(usuarioId: number): Promise<EmpleadoSede | null> {
    const fila = await this.prisma.empleadoSede.findUnique({ where: { usuario_id: usuarioId } });
    return fila ? { id: fila.id, usuarioId: fila.usuario_id, sedeId: fila.sede_id } : null;
  }

  // La unicidad de `sede_id` en EmpleadoSede es la regla "un recepcionista por
  // sede": este chequeo permite responder 409 con un detail legible antes de
  // intentar el INSERT (que igual la base rechaza si hay carrera).
  async buscarPorSedeId(sedeId: number): Promise<EmpleadoSede | null> {
    const fila = await this.prisma.empleadoSede.findUnique({ where: { sede_id: sedeId } });
    return fila ? { id: fila.id, usuarioId: fila.usuario_id, sedeId: fila.sede_id } : null;
  }

  // M1 no importa M2 (que ya importa M1) para validar la existencia de la sede:
  // la consulta queda aca, junto al resto de la lectura de EmpleadoSede.
  async existeSede(sedeId: number): Promise<boolean> {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true } });
    return sede !== null;
  }
}
