import { Injectable } from '@nestjs/common';
import { MembresiaRepository } from '../domain/membresia.port';
import type { MembresiaParaCobro } from '../domain/membresia.port';

// Exportado desde UsuariosModule para que M5 lea el precio sin escribir una consulta
// sobre la tabla Membresia: ADR-07 deja cada tabla con un solo lugar donde se
// consultan sus filas, y ese lugar es MembresiaRepository, adentro de M1. Por eso
// este service no tiene Prisma, solo orquesta el repositorio, que ya devuelve el tipo
// de dominio `MembresiaParaCobro` (precio como number, usuario resuelto por el socio).
// El precio NO sale en la respuesta de la API: MembresiaOut es lista blanca
// (@Exclude de clase con @Expose por campo), así que el dominio puede llevarlo sin
// que se filtre.
@Injectable()
export class MembresiaPrecioService {
  constructor(private readonly membresias: MembresiaRepository) {}

  // null cuando la membresía no existe, para que M5 lo traduzca a 404 con su propio
  // problem type en vez de propagar hacia afuera una excepción de M1.
  async obtenerParaCobro(membresiaId: number): Promise<MembresiaParaCobro | null> {
    return this.membresias.obtenerParaCobro(membresiaId);
  }
}
