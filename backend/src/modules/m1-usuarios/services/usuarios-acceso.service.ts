import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { UsuarioIn } from '../dtos/usuario-in.dto';
import { UsuarioOut } from '../dtos/usuario-out.dto';
import { UsuarioPatch } from '../dtos/usuario-patch.dto';
import {
  exigirPuedeCrearRol,
  exigirPuedeModificar,
  exigirUsuarioPropio,
  necesitaRolDelObjetivo,
} from './alcance-usuarios';
import { UsuariosService } from './usuarios.service';

/**
 * Lo que el controller de /usuarios le pide a M1 en nombre de una persona con sesion: aplica el alcance por rol
 * (`alcance-usuarios.ts`) y delega en `UsuariosService`, que no sabe de quien llama. El login, el comprobante de pago y
 * el resto de los flujos internos usan `UsuariosService` directo y no pasan por aca.
 */
@Injectable()
export class UsuariosAccesoService {
  constructor(private readonly usuarios: UsuariosService) {}

  crear(actor: UsuarioAutenticado, dto: UsuarioIn): Promise<UsuarioOut> {
    exigirPuedeCrearRol(actor, dto.rol);
    return this.usuarios.crear(dto);
  }

  async obtener(actor: UsuarioAutenticado, id: number): Promise<UsuarioOut> {
    exigirUsuarioPropio(actor, id);
    return this.usuarios.obtenerPorId(id);
  }

  async modificar(actor: UsuarioAutenticado, id: number, dto: UsuarioPatch): Promise<UsuarioOut> {
    if (necesitaRolDelObjetivo(actor)) {
      // Si el usuario no existe, obtenerPorId responde el 404 de siempre antes de decidir nada.
      const objetivo = await this.usuarios.obtenerPorId(id);
      exigirPuedeModificar(actor, id, objetivo.rol);
    }
    return this.usuarios.modificar(id, dto);
  }
}
