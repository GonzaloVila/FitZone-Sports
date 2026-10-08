import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../commons/database/prisma.service';

export interface EmpleadoSede {
  id: number;
  usuarioId: number;
  sedeId: number;
}

// Capa de acceso a datos del staff de sucursal (rol RECEPCION, A3). Hoy el
// unico consumidor es AuthService, para resolver el sedeId que va en el JWT
// de un recepcionista al loguearse; no hay endpoint propio (ver "Alcance NO
// incluido" del plan de M1).
@Injectable()
export class EmpleadoSedeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorUsuarioId(usuarioId: number): Promise<EmpleadoSede | null> {
    const fila = await this.prisma.empleadoSede.findUnique({ where: { usuario_id: usuarioId } });
    return fila ? { id: fila.id, usuarioId: fila.usuario_id, sedeId: fila.sede_id } : null;
  }
}
