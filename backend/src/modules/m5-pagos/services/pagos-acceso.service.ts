import { Injectable } from '@nestjs/common';
import { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import { ReservaClasePrecioService } from '../../m3-clases/services/reserva-clase-precio.service';
import { ReservaPrecioService } from '../../m4-canchas/services/reserva-precio.service';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { conceptoDePago, PagoIn } from '../dtos/pago-in.dto';
import { PagoOut } from '../dtos/pago-out.dto';
import { ConceptoPago } from '../entities/pago.entity';
import {
  exigirConceptoPropio,
  exigirPagoPropio,
  usuarioDelListado,
  veSoloLoPropio,
} from './alcance-pagos';
import { ComprobanteParaDescargar, ListarPagos, PagosService } from './pagos.service';

/**
 * Lo que el controller de /pagos le pide a M5 en nombre de una persona con sesion: aplica el
 * alcance por rol (`alcance-pagos.ts`) y delega en `PagosService`, que no sabe de quien llama.
 *
 * `PagosService` queda sin cambios a proposito: los cobros internos (renovacion de membresia,
 * alta, cambio de plan y penalidad de clase) lo usan o replican sin actor ni alcance, y no
 * pueden quedar restringidos.
 */
@Injectable()
export class PagosAccesoService {
  constructor(
    private readonly pagos: PagosService,
    private readonly membresias: MembresiaPrecioService,
    private readonly reservas: ReservaPrecioService,
    private readonly reservaClases: ReservaClasePrecioService,
  ) {}

  async procesar(actor: UsuarioAutenticado, dto: PagoIn, idempotenciaKey: string): Promise<PagoOut> {
    if (veSoloLoPropio(actor)) {
      const concepto = conceptoDePago(dto.concepto);
      const duenio = await this.duenioDelConcepto(concepto);
      // Si el concepto no existe no hay dueño que comparar: lo resuelve PagosService con su propio 404.
      if (duenio !== null) exigirConceptoPropio(actor, duenio, concepto);
    }
    return this.pagos.procesarPago(dto, idempotenciaKey);
  }

  listar(actor: UsuarioAutenticado, filtros: ListarPagos): Promise<{ items: PagoOut[]; total: number }> {
    return this.pagos.listarPagos({ ...filtros, usuarioId: usuarioDelListado(actor, filtros.usuarioId) });
  }

  async obtener(actor: UsuarioAutenticado, pagoId: number): Promise<PagoOut> {
    const pago = await this.pagos.obtenerPago(pagoId);
    exigirPagoPropio(actor, pago.usuarioId, pagoId);
    return pago;
  }

  async comprobante(actor: UsuarioAutenticado, pagoId: number): Promise<ComprobanteParaDescargar> {
    // Primero el dueño: el 409 de "no aprobado" no se le cuenta a quien no puede ver el pago.
    await this.obtener(actor, pagoId);
    return this.pagos.obtenerComprobante(pagoId);
  }

  private async duenioDelConcepto(concepto: ConceptoPago): Promise<number | null> {
    if (concepto.tipo === 'RESERVA_CANCHA') {
      return (await this.reservas.obtenerParaCobro(concepto.reservaCanchaId))?.usuarioId ?? null;
    }
    if (concepto.tipo === 'RESERVA_CLASE') {
      return (await this.reservaClases.obtenerParaCobro(concepto.reservaClaseId))?.usuarioId ?? null;
    }
    return (await this.membresias.obtenerParaCobro(concepto.membresiaId))?.usuarioId ?? null;
  }
}
