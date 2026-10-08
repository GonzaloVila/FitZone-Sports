import { describe, expect, it } from 'vitest';
import { PasarelaPagoService } from 'src/modules/m5-pagos/services/pasarela-pago.service';

// Fijan el resultado del mock de la pasarela. Lo que importa acá es que la
// decisión sea DETERMINISTA (el e2e tiene que ser hermético y repetible) y que el
// rechazo sea un valor de retorno y no una excepción: `PagosService` persiste el
// RECHAZADO y después responde 402, y si esto fuera un `throw` no habría estado
// que persistir ni fila que listar.
describe('PasarelaPagoService (mock)', () => {
  const pasarela = new PasarelaPagoService();

  const solicitud = {
    token: 'tok_aprobado_1',
    monto: 4250,
    moneda: 'ARS',
    idempotenciaKey: 'clave-1',
  };

  it('aprueba el token con prefijo tok_aprobado y devuelve el token de la pasarela', async () => {
    const resultado = await pasarela.cobrar(solicitud);

    expect(resultado).toEqual({ estado: 'APROBADO', pasarelaToken: 'tok_aprobado_1' });
  });

  it('deja PENDIENTE el token con prefijo tok_pendiente', async () => {
    const resultado = await pasarela.cobrar({ ...solicitud, token: 'tok_pendiente_1' });

    expect(resultado).toEqual({ estado: 'PENDIENTE', pasarelaToken: 'tok_pendiente_1' });
  });

  it('rechaza cualquier otro token sin tirar excepción', async () => {
    const resultado = await pasarela.cobrar({ ...solicitud, token: 'tok_rechazado_1' });

    expect(resultado.estado).toBe('RECHAZADO');
    // El motivo es lo que va al `detail` del 402 del contrato, así que tiene que
    // existir y ser texto, no un código.
    expect(resultado).toHaveProperty('motivo');
    expect(typeof (resultado as { motivo: string }).motivo).toBe('string');
  });

  it('es determinista: el mismo token da el mismo resultado siempre', async () => {
    const [a, b] = await Promise.all([
      pasarela.cobrar(solicitud),
      pasarela.cobrar(solicitud),
    ]);

    expect(a).toEqual(b);
  });

  // El resultado NO depende del monto ni de la clave de idempotencia: el mock
  // decide por el token y nada más. Si apareciera un monto de cobro en la regla,
  // este test avisa, porque el e2e empezaría a depender de fixtures de precio.
  it('no mira el monto ni la clave de idempotencia', async () => {
    const barato = await pasarela.cobrar({ ...solicitud, monto: 1 });
    const caro = await pasarela.cobrar({ ...solicitud, monto: 999999 });

    expect(barato.estado).toBe('APROBADO');
    expect(caro.estado).toBe('APROBADO');
  });

  it('reembolsa sin tirar excepción', async () => {
    await expect(pasarela.reembolsar(solicitud)).resolves.toEqual({ ok: true });
  });
});