import { describe, expect, it, vi } from 'vitest';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { armar, cuerpoDe, dtoDe, pagoPersistido } from '@test/helpers/pagos.fixtures';

// PagosService - cobro: orden de los pasos, monto, traducción de errores y ciclo.
describe('PagosService - cobro', () => {
  describe('no toca la pasarela si no corresponde', () => {
    it('no llega a la pasarela si la clave ya se usó', async () => {
      const { service, pagos, pasarela } = armar({
        crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' }),
      });

      await expect(service.procesarPago(dtoDe(), 'clave-1')).rejects.toBeInstanceOf(ProblemException);
      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });

    it('no inserta si el concepto no existe', async () => {
      const { service, pagos, pasarela } = armar({ reserva: null });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo.status).toBe(404);
      expect(pagos.crear).not.toHaveBeenCalled();
      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });
  });

  describe('monto', () => {
    it('copia el precio congelado de la reserva, sin recalcularlo', async () => {
      const { service, pagos } = armar();

      await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.crear).toHaveBeenCalledWith(expect.objectContaining({ monto: 8000, usuarioId: 3 }));
    });

    it('copia el precio de la membresía para el concepto MEMBRESIA', async () => {
      const { service, pagos, reservas } = armar();

      await service.procesarPago(
        dtoDe({ concepto: { tipo: 'MEMBRESIA', membresiaId: 5, reservaCanchaId: undefined } }),
        'clave-1',
      );

      expect(reservas.obtenerParaCobro).not.toHaveBeenCalled();
      expect(pagos.crear).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 30000, concepto: { tipo: 'MEMBRESIA', membresiaId: 5 } }),
      );
    });

    it('defaulta la moneda a ARS cuando el body no la manda', async () => {
      const { service, pagos } = armar();

      await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.crear).toHaveBeenCalledWith(expect.objectContaining({ moneda: 'ARS' }));
    });
  });

  describe('traducción de errores', () => {
    it('404 con el detalle del recurso inexistente', async () => {
      const { service } = armar({ membresia: null });

      const cuerpo = await cuerpoDe(
        service.procesarPago(
          dtoDe({ concepto: { tipo: 'MEMBRESIA', membresiaId: 99, reservaCanchaId: undefined } }),
          'clave-1',
        ),
      );

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toContain('99');
    });

    it('409 idempotencia-repetida con el type del contrato', async () => {
      const { service } = armar({
        crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' }),
      });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo).toMatchObject({
        status: 409,
        type: 'https://fitzone.app/errores/idempotencia-repetida',
        title: 'Idempotency-Key repetida',
      });
    });

    it('409 reserva-ya-cobrada, que NO es idempotencia', async () => {
      const { service } = armar({
        crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'RESERVA_YA_COBRADA' }),
      });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo.status).toBe(409);
      expect(cuerpo.detail).toContain('7');
      expect(cuerpo.detail).not.toContain('clave-1');
    });
  });

  describe('ciclo del cobro', () => {
    it('persiste el pago antes de transicionar a APROBADO', async () => {
      const { service, pagos } = armar();

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.transicionar).toHaveBeenCalledWith(12, 'APROBADO');
      expect(salida.estado).toBe('APROBADO');
      expect(salida.id).toBe(12);
    });

    it('deja PENDIENTE sin transicionar cuando la pasarela no resuelve', async () => {
      const { service, pagos } = armar({
        cobrar: vi.fn().mockResolvedValue({ estado: 'PENDIENTE', pasarelaToken: 'tok_pendiente_1' }),
      });

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.transicionar).not.toHaveBeenCalled();
      expect(salida.estado).toBe('PENDIENTE');
    });

    it('un rechazo responde 402 pero igual queda persistido como RECHAZADO', async () => {
      const { service, pagos } = armar({
        cobrar: vi.fn().mockResolvedValue({ estado: 'RECHAZADO', motivo: 'Fondos insuficientes' }),
        transicionar: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'RECHAZADO' })),
      });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo).toMatchObject({ status: 402, title: 'Pago rechazado', detail: 'Fondos insuficientes' });
      expect(pagos.transicionar).toHaveBeenCalledWith(12, 'RECHAZADO');
    });

    it('no expone el token ni la clave en la respuesta', async () => {
      const { service } = armar();

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(salida).not.toHaveProperty('token');
      expect(salida).not.toHaveProperty('idempotenciaKey');
    });
  });
});
