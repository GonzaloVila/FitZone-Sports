import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { BuscarCanchasQueryDto } from 'src/modules/m4-canchas/dtos/buscar-canchas-query.dto';
import { CanchaIn } from 'src/modules/m4-canchas/dtos/cancha-in.dto';
import { CanchaPatch } from 'src/modules/m4-canchas/dtos/cancha-patch.dto';
import { ListarCanchasQueryDto } from 'src/modules/m4-canchas/dtos/listar-canchas-query.dto';
import { ReservaCanchaIn } from 'src/modules/m4-canchas/dtos/reserva-cancha-in.dto';
import { erroresDe } from '@test/helpers/validar-dto';

// Validación de los DTOs de entrada de M4 (el 422 por input que antes vivía en e2e).
describe('M4 - DTOs de canchas y reservas', () => {
  describe('CanchaIn', () => {
    it('acepta tipo y costo válidos, con o sin estado', async () => {
      expect(await erroresDe(CanchaIn, { tipo: 'PADDLE', costoPorHora: 5000 })).toEqual([]);
      expect(await erroresDe(CanchaIn, { tipo: 'FUTBOL5', costoPorHora: 0, estado: 'EN_MANTENIMIENTO' })).toEqual([]);
    });

    it('rechaza un tipo fuera del enum y un costo negativo', async () => {
      expect(await erroresDe(CanchaIn, { tipo: 'TENIS', costoPorHora: 5000 })).not.toEqual([]);
      expect(await erroresDe(CanchaIn, { tipo: 'PADDLE', costoPorHora: -1 })).not.toEqual([]);
    });

    it('rechaza un estado inválido', async () => {
      expect(await erroresDe(CanchaIn, { tipo: 'PADDLE', costoPorHora: 5000, estado: 'ROTA' })).not.toEqual([]);
    });

    it('exige tipo y costoPorHora, y rechaza campos desconocidos', async () => {
      expect(await erroresDe(CanchaIn, {})).not.toEqual([]);
      expect(await erroresDe(CanchaIn, { tipo: 'PADDLE', costoPorHora: 5000, sedeId: 1 })).not.toEqual([]);
    });
  });

  describe('CanchaPatch', () => {
    it('acepta body vacío (todos los campos son opcionales)', async () => {
      expect(await erroresDe(CanchaPatch, {})).toEqual([]);
    });

    it('acepta costo o estado sueltos', async () => {
      expect(await erroresDe(CanchaPatch, { costoPorHora: 5500 })).toEqual([]);
      expect(await erroresDe(CanchaPatch, { estado: 'EN_MANTENIMIENTO' })).toEqual([]);
    });

    it('rechaza costo negativo, estado inválido y tipo (no editable)', async () => {
      expect(await erroresDe(CanchaPatch, { costoPorHora: -1 })).not.toEqual([]);
      expect(await erroresDe(CanchaPatch, { estado: 'ROTA' })).not.toEqual([]);
      expect(await erroresDe(CanchaPatch, { tipo: 'FUTBOL5' })).not.toEqual([]);
    });
  });

  describe('ReservaCanchaIn', () => {
    const valido = {
      canchaId: 1,
      usuarioId: 2,
      fechaHoraInicio: '2026-10-05T19:00:00-03:00',
      fechaHoraFin: '2026-10-05T20:00:00-03:00',
    };

    it('acepta una reserva bien formada', async () => {
      expect(await erroresDe(ReservaCanchaIn, valido)).toEqual([]);
    });

    // El contrato exige zona: sin Z/offset, new Date() la interpreta en la zona del
    // proceso y la reserva cae en otra hora según dónde corra el server.
    it('rechaza fechas sin zona horaria', async () => {
      expect(await erroresDe(ReservaCanchaIn, { ...valido, fechaHoraInicio: '2026-10-05T19:00:00' })).not.toEqual([]);
      expect(await erroresDe(ReservaCanchaIn, { ...valido, fechaHoraFin: '2026-10-05' })).not.toEqual([]);
    });

    it('rechaza ids no positivos', async () => {
      expect(await erroresDe(ReservaCanchaIn, { ...valido, canchaId: 0 })).not.toEqual([]);
      expect(await erroresDe(ReservaCanchaIn, { ...valido, usuarioId: -1 })).not.toEqual([]);
    });

    it('rechaza campos desconocidos', async () => {
      expect(await erroresDe(ReservaCanchaIn, { ...valido, precioAplicado: 1 })).not.toEqual([]);
    });
  });

  describe('ListarCanchasQueryDto', () => {
    it('acepta consulta vacía y convierte page/perPage a número', async () => {
      expect(await erroresDe(ListarCanchasQueryDto, {})).toEqual([]);

      const d = plainToInstance(ListarCanchasQueryDto, { page: '2', perPage: '5' });
      expect(d.page).toBe(2);
      expect(d.perPage).toBe(5);
    });

    it('rechaza un estado inválido y la paginación fuera de rango', async () => {
      expect(await erroresDe(ListarCanchasQueryDto, { estado: 'INVALIDA' })).not.toEqual([]);
      expect(await erroresDe(ListarCanchasQueryDto, { page: '0' })).not.toEqual([]);
      expect(await erroresDe(ListarCanchasQueryDto, { perPage: '101' })).not.toEqual([]);
    });

    it('rechaza un parámetro fuera de la lista blanca', async () => {
      expect(await erroresDe(ListarCanchasQueryDto, { parametro: 'futuro' })).not.toEqual([]);
    });
  });

  describe('BuscarCanchasQueryDto', () => {
    it('acepta consulta vacía y todos los filtros combinados', async () => {
      expect(await erroresDe(BuscarCanchasQueryDto, {})).toEqual([]);
      expect(
        await erroresDe(BuscarCanchasQueryDto, {
          sedeId: '3',
          tipo: 'PADDLE',
          estado: 'EN_MANTENIMIENTO',
          page: '2',
          perPage: '50',
        }),
      ).toEqual([]);
    });

    it('convierte sedeId, page y perPage a número y aplica los defaults', () => {
      const d = plainToInstance(BuscarCanchasQueryDto, { sedeId: '3', page: '2', perPage: '5' });
      expect(d.sedeId).toBe(3);
      expect(d.page).toBe(2);
      expect(d.perPage).toBe(5);

      const vacio = plainToInstance(BuscarCanchasQueryDto, {});
      expect(vacio.sedeId).toBeUndefined();
      expect(vacio.page).toBe(1);
      expect(vacio.perPage).toBe(20);
    });

    it('rechaza sedeId no entero, no positivo o no numérico', async () => {
      expect(await erroresDe(BuscarCanchasQueryDto, { sedeId: '0' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { sedeId: '-1' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { sedeId: '2.5' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { sedeId: 'abc' })).not.toEqual([]);
    });

    it('rechaza un tipo o un estado fuera del enum', async () => {
      expect(await erroresDe(BuscarCanchasQueryDto, { tipo: 'TENIS' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { tipo: 'paddle' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { estado: 'ROTA' })).not.toEqual([]);
    });

    it('rechaza la paginación fuera de rango (mismo tope que el listado por sede)', async () => {
      expect(await erroresDe(BuscarCanchasQueryDto, { page: '0' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { perPage: '0' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { perPage: '101' })).not.toEqual([]);
      expect(await erroresDe(BuscarCanchasQueryDto, { perPage: '100' })).toEqual([]);
    });

    it('rechaza un parámetro fuera de la lista blanca', async () => {
      expect(await erroresDe(BuscarCanchasQueryDto, { parametro: 'futuro' })).not.toEqual([]);
    });

    // El listado por sede toma la sede de la ruta: seguir rechazando sedeId/tipo en su
    // query evita que el DTO nuevo cambie el contrato de GET /sedes/{sedeId}/canchas.
    it('ListarCanchasQueryDto sigue sin aceptar sedeId ni tipo', async () => {
      expect(await erroresDe(ListarCanchasQueryDto, { sedeId: '3' })).not.toEqual([]);
      expect(await erroresDe(ListarCanchasQueryDto, { tipo: 'PADDLE' })).not.toEqual([]);
    });
  });
});
