import { describe, expect, it } from 'vitest';
import { ClaseIn } from 'src/modules/m3-clases/dtos/clase-in.dto';
import { EsperaIn } from 'src/modules/m3-clases/dtos/espera-in.dto';
import { ReservaClaseIn } from 'src/modules/m3-clases/dtos/reserva-clase-in.dto';
import { erroresDe } from '@test/helpers/validar-dto';

// Validación de los DTOs de entrada de M3 (el 422 por input que antes vivía en e2e).
describe('M3 - DTOs de clases, reservas y espera', () => {
  describe('ClaseIn', () => {
    const valido = {
      sedeId: 1,
      tipo: 'Spinning',
      instructor: 'Martín Palermo',
      horarioInicio: '2026-10-15T18:00:00-03:00',
      horarioFin: '2026-10-15T19:00:00-03:00',
      capacidad: 20,
    };

    it('acepta una clase bien formada', async () => {
      expect(await erroresDe(ClaseIn, valido)).toEqual([]);
    });

    it('rechaza sedeId y capacidad no positivos', async () => {
      expect(await erroresDe(ClaseIn, { ...valido, sedeId: 0 })).not.toEqual([]);
      expect(await erroresDe(ClaseIn, { ...valido, capacidad: 0 })).not.toEqual([]);
    });

    it('rechaza tipo o instructor vacíos', async () => {
      expect(await erroresDe(ClaseIn, { ...valido, tipo: '' })).not.toEqual([]);
      expect(await erroresDe(ClaseIn, { ...valido, instructor: '' })).not.toEqual([]);
    });

    it('rechaza horarios no ISO y campos faltantes', async () => {
      expect(await erroresDe(ClaseIn, { ...valido, horarioInicio: 'el martes' })).not.toEqual([]);
      const { horarioFin, ...sinFin } = valido;
      expect(await erroresDe(ClaseIn, sinFin)).not.toEqual([]);
    });

    it('rechaza campos desconocidos', async () => {
      expect(await erroresDe(ClaseIn, { ...valido, cupoDisponible: 5 })).not.toEqual([]);
    });
  });

  describe('ReservaClaseIn', () => {
    it('acepta ids positivos', async () => {
      expect(await erroresDe(ReservaClaseIn, { claseId: 1, socioId: 2 })).toEqual([]);
    });

    it('rechaza ids no positivos o faltantes', async () => {
      expect(await erroresDe(ReservaClaseIn, { claseId: 1, socioId: 0 })).not.toEqual([]);
      expect(await erroresDe(ReservaClaseIn, { socioId: 2 })).not.toEqual([]);
    });
  });

  describe('EsperaIn', () => {
    it('acepta un socioId positivo y rechaza el resto', async () => {
      expect(await erroresDe(EsperaIn, { socioId: 2 })).toEqual([]);
      expect(await erroresDe(EsperaIn, { socioId: 0 })).not.toEqual([]);
      expect(await erroresDe(EsperaIn, {})).not.toEqual([]);
    });
  });
});
