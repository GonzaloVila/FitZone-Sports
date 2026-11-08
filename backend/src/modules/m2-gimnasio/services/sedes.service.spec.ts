import { describe, expect, it, vi } from 'vitest';
import type { SedeRepository } from '../repositories/sede.repository';
import { SedesService } from './sedes.service';

const SEDE = { id: 3, nombre: 'Norte', direccion: 'Av. Siempre Viva 742', aforoMaximo: 80 };

function armar() {
  const sedes = { buscarPorId: vi.fn(), listar: vi.fn(), crear: vi.fn() };
  return { service: new SedesService(sedes as unknown as SedeRepository), sedes };
}

describe('SedesService', () => {
  it('existe() responde segun lo que encuentre el repositorio (lo usa M4 al dar de alta canchas)', async () => {
    const { service, sedes } = armar();
    sedes.buscarPorId.mockResolvedValueOnce(SEDE).mockResolvedValueOnce(null);

    expect(await service.existe(3)).toBe(true);
    expect(await service.existe(99)).toBe(false);
  });

  it('listar pagina con lo que recibe y devuelve items y total', async () => {
    const { service, sedes } = armar();
    sedes.listar.mockResolvedValue({ items: [SEDE], total: 7 });

    const res = await service.listar(2, 5);

    expect(sedes.listar).toHaveBeenCalledWith({ page: 2, perPage: 5 });
    expect(res).toEqual({ items: [expect.objectContaining(SEDE)], total: 7 });
  });

  it('crear delega en el repositorio y devuelve la sede creada', async () => {
    const { service, sedes } = armar();
    sedes.crear.mockResolvedValue(SEDE);
    const alta = { nombre: 'Norte', direccion: 'Av. Siempre Viva 742', aforoMaximo: 80 };

    expect(await service.crear(alta as never)).toMatchObject(SEDE);
    expect(sedes.crear).toHaveBeenCalledWith(alta);
  });
});
