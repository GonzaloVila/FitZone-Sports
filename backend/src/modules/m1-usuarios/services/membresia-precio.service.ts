import { Injectable } from '@nestjs/common';
import { EstadoMembresia, PlanMembresia } from '../entities/membresia.entity';
import { MembresiaRepository } from '../repositories/membresia.repository';

// Lo único que M5 necesita de una membresía para cobrar: el precio congelado, el
// plan, de quién es y en qué estado está. `MembresiaOut` no sirve para esto (expone
// el plan pero ni el precio ni el usuario) y no se va a ampliar el DTO de la API
// para meterle el precio a M5 por la puerta de atrás.
export interface MembresiaParaCobro {
  membresia_id: number;
  usuario_id: number;
  plan: PlanMembresia;
  precio: number;
  estado: EstadoMembresia;
}

// Exportado desde UsuariosModule para que M5 lea el precio sin escribir una consulta
// sobre la tabla Membresia: ADR-07 deja cada tabla con un solo lugar donde se
// consultan sus filas, y ese lugar es MembresiaRepository, adentro de M1. Por eso
// este service no tiene Prisma, solo orquesta el repositorio y devuelve el tipo de
// arriba. El precio NO sale en la respuesta de la API: MembresiaOut es lista blanca
// (@Exclude de clase con @Expose por campo), así que el dominio puede llevarlo sin
// que se filtre.
@Injectable()
export class MembresiaPrecioService {
  constructor(private readonly membresias: MembresiaRepository) {}

  // null cuando la membresía no existe, para que M5 lo traduzca a 404 con su propio
  // problem type en vez de propagar hacia afuera una excepción de M1.
  async obtenerParaCobro(membresiaId: number): Promise<MembresiaParaCobro | null> {
    const fila = await this.membresias.obtenerParaCobro(membresiaId);
    if (!fila) {
      return null;
    }

    return {
      membresia_id: fila.id,
      usuario_id: fila.socio.usuario_id,
      plan: fila.plan,
      precio: fila.precio.toNumber(),
      estado: fila.estado,
    };
  }
}