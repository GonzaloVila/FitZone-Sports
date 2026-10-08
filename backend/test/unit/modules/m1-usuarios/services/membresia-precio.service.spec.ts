import { describe, expect, it } from 'vitest';
import { MembresiaPrecioService } from 'src/modules/m1-usuarios/services/membresia-precio.service';
import type { MembresiaRepository } from 'src/modules/m1-usuarios/domain/membresia.port';

// Fijan el contrato del export que M5 consume. El cruce a Socio y la conversion del
// Decimal de Prisma a number viven ahora en el adaptador (ver
// membresia.repository.spec.ts); aca se fija que el service entregue el tipo de
// dominio tal cual, con las mismas claves, y que un id inexistente sea `null` y no
// una excepcion de M1.
describe('MembresiaPrecioService', () => {
  function service(dominio: unknown) {
    const repo = {
      obtenerParaCobro: async () => dominio,
    } as unknown as MembresiaRepository;
    return new MembresiaPrecioService(repo);
  }

  function paraCobro(over: Record<string, unknown> = {}) {
    return {
      membresiaId: 7,
      usuarioId: 42,
      plan: 'TRIMESTRAL',
      precio: 80000,
      estado: 'ACTIVA',
      ...over,
    };
  }

  it('devuelve precio como number, con plan, estado y usuario del socio', async () => {
    const resultado = await service(paraCobro()).obtenerParaCobro(7);

    expect(resultado).toEqual({
      membresiaId: 7,
      usuarioId: 42,
      plan: 'TRIMESTRAL',
      precio: 80000,
      estado: 'ACTIVA',
    });
    expect(typeof resultado!.precio).toBe('number');
  });

  it('no filtra el precio por la API aunque si lo lleve en el dominio', async () => {
    const resultado = await service(paraCobro()).obtenerParaCobro(7);

    // El precio viaja en el tipo de retorno a proposito (M5 lo necesita) pero no se
    // expone: `MembresiaOut` es lista blanca. Este test existe para que agregar
    // `precio` al DTO de salida sea una decision explicita, no un descuido.
    expect(Object.keys(resultado!).sort()).toEqual([
      'estado',
      'membresiaId',
      'plan',
      'precio',
      'usuarioId',
    ]);
  });

  it('devuelve null cuando la membresia no existe', async () => {
    await expect(service(null).obtenerParaCobro(999)).resolves.toBeNull();
  });
});
