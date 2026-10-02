import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { MembresiaPrecioService } from './membresia-precio.service';
import type { MembresiaRepository } from '../repositories/membresia.repository';

// Fijan el contrato del export que M5 consume. Lo que importa no es la logica (es un
// rename) sino tres cosas que se rompen en silencio: que el precio salga como `number`
// y no como el `Decimal` de Prisma (el `Pago.monto` es Decimal y un number[float]
// manda ruido ahi), que cruce a Socio por `usuario_id` (la membresia no lo tiene), y
// que un id inexistente sea `null` y no una excepcion de M1.
describe('MembresiaPrecioService', () => {
  function service(fila: unknown) {
    const repo = {
      obtenerParaCobro: async () => fila,
    } as unknown as MembresiaRepository;
    return new MembresiaPrecioService(repo);
  }

  function fila(over: Record<string, unknown> = {}) {
    return {
      id: 7,
      plan: 'TRIMESTRAL',
      estado: 'ACTIVA',
      precio: new Prisma.Decimal('80000'),
      socio: { usuario_id: 42 },
      ...over,
    };
  }

  it('devuelve precio como number, con plan, estado y usuario del socio', async () => {
    const resultado = await service(fila()).obtenerParaCobro(7);

    expect(resultado).toEqual({
      membresia_id: 7,
      usuario_id: 42,
      plan: 'TRIMESTRAL',
      precio: 80000,
      estado: 'ACTIVA',
    });
    expect(typeof resultado!.precio).toBe('number');
  });

  it('no filtra el precio por la API aunque si lo lleve en el dominio', async () => {
    const resultado = await service(fila()).obtenerParaCobro(7);

    // El precio viaja en el tipo de retorno a proposito (M5 lo necesita) pero no se
    // expone: `MembresiaOut` es lista blanca. Este test existe para que agregar
    // `precio` al DTO de salida sea una decision explicita, no un descuido.
    expect(Object.keys(resultado!).sort()).toEqual([
      'estado',
      'membresia_id',
      'plan',
      'precio',
      'usuario_id',
    ]);
  });

  it('devuelve null cuando la membresia no existe', async () => {
    await expect(service(null).obtenerParaCobro(999)).resolves.toBeNull();
  });
});