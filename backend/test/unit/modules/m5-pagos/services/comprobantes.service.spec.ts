import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembresiaPrecioService } from 'src/modules/m1-usuarios/services/membresia-precio.service';
import type { UsuariosService } from 'src/modules/m1-usuarios/services/usuarios.service';
import type { ReservaClasePrecioService } from 'src/modules/m3-clases/services/reserva-clase-precio.service';
import type { ReservaPrecioService } from 'src/modules/m4-canchas/services/reserva-precio.service';
import { ConceptoPago, Pago } from 'src/modules/m5-pagos/entities/pago.entity';
import { ComprobantesService, RUTA_COMPROBANTES } from 'src/modules/m5-pagos/services/comprobantes.service';

const INICIO = new Date('2026-10-10T14:00:00.000Z');
const FIN = new Date('2026-10-10T15:00:00.000Z');

const RESERVA_CANCHA = { tipo: 'RESERVA_CANCHA', reservaCanchaId: 12 } as const;
const MEMBRESIA = { tipo: 'MEMBRESIA', membresiaId: 5 } as const;
const RESERVA_CLASE = { tipo: 'RESERVA_CLASE', reservaClaseId: 3 } as const;

/**
 * El texto que se imprime en el PDF, en orden.
 *
 * pdfkit escribe cada texto como su cadena en hexadecimal dentro del content stream
 * (`[<436f6d70...> 0] TJ`), así que "abrir el PDF y assertar que dice el monto" es
 * exactamente esto: decodificar los hex y concatenar. Es la razón por la que el
 * documento se genera con `compress: false` — con los streams comprimidos no hay nada
 * que assertar del contenido, y un test que solo mira el `%PDF-` inicial no
 * comprobaría que el comprobante diga el monto correcto (RF-14).
 *
 * Los hex se pegan SIN separador porque pdfkit parte una misma palabra en varios runs
 * por el kerning ("FitZone Spor" + "ts"): con un espacio en el medio, "FitZone Sports"
 * nunca aparecería escrito y el test no probaría nada.
 */
function textoDelPdf(buffer: Buffer): string {
  return (buffer.toString('latin1').match(/<([0-9a-fA-F]+)>/g) ?? [])
    .map((m) => m.slice(1, -1))
    .map((hex) =>
      (hex.match(/../g) ?? [])
        .map((byte) => String.fromCharCode(parseInt(byte, 16)))
        .join(''),
    )
    .join('');
}

function pago(over: Partial<Pago> = {}): Pago {
  return {
    id: 8,
    usuarioId: 42,
    concepto: RESERVA_CANCHA,
    monto: 9500,
    moneda: 'ARS',
    estado: 'APROBADO',
    fechaPago: new Date('2026-10-10T14:05:00.000Z'),
    comprobantePdfUrl: null,
    token: 'tok_aprobado_1',
    idempotenciaKey: 'clave-1',
    ...over,
  };
}

describe('ComprobantesService', () => {
  const directorio = join(process.cwd(), 'storage', 'comprobantes');

  function armar(over: { reserva?: unknown; membresia?: unknown; reservaClase?: unknown } = {}) {
    const reservas = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.reserva === undefined
          ? {
              reservaId: 12,
              usuarioId: 42,
              canchaId: 3,
              fechaHoraInicio: INICIO,
              fechaHoraFin: FIN,
              precio: 9500,
              estado: 'CONFIRMADA',
            }
          : over.reserva,
      ),
    };
    const membresias = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.membresia === undefined
          ? { membresiaId: 5, usuarioId: 42, plan: 'MENSUAL', precio: 30000, estado: 'ACTIVA' }
          : over.membresia,
      ),
    };
    // RF-07: la penalidad de la clase la resuelve M3 (ReservaClasePrecioService).
    const reservasClases = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.reservaClase === undefined
          ? {
              reservaClaseId: 3,
              socioId: 42,
              usuarioId: 42,
              claseId: 9,
              horario: '2026-10-10T14:00:00.000Z',
              penalidad: 5000,
            }
          : over.reservaClase,
      ),
    };
    const usuarios = {
      buscarDatosParaComprobante: vi.fn().mockResolvedValue({ nombre: 'Ana Gómez', email: 'ana@fitzone.com' }),
    };

    const service = new ComprobantesService(
      reservas as unknown as ReservaPrecioService,
      membresias as unknown as MembresiaPrecioService,
      reservasClases as unknown as ReservaClasePrecioService,
      usuarios as unknown as UsuariosService,
    );
    return { service, usuarios, reservasClases };
  }

  beforeEach(async () => {
    await rm(directorio, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(directorio, { recursive: true, force: true });
  });

  it('escribe un PDF real y devuelve la ruta pública', async () => {
    const { service } = armar();

    const ruta = await service.generar(pago(), RESERVA_CANCHA as ConceptoPago);
    const bytes = await service.leer(ruta);

    expect(ruta).toBe(`${RUTA_COMPROBANTES}/8.pdf`);
    expect(bytes).not.toBeNull();
    expect(bytes!.subarray(0, 5).toString()).toBe('%PDF-');
  });

  // El smoke del bloque 3: el PDF tiene que llevar el monto CONGELADO, no el precio de
  // la cancha en el momento de imprimir. Se pasa un `pago.monto` de 9500 mientras el
  // export de M4 devuelve otro precio, y lo que se asserta es que gana el del pago.
  it('imprime el monto del pago y no recalcula el precio', async () => {
    const { service } = armar({
      reserva: {
        reservaId: 12,
        usuarioId: 42,
        canchaId: 3,
        fechaHoraInicio: INICIO,
        fechaHoraFin: FIN,
        precio: 7777,
        estado: 'CONFIRMADA',
      },
    });

    const ruta = await service.generar(pago({ monto: 9500 }), RESERVA_CANCHA as ConceptoPago);
    const texto = textoDelPdf((await service.leer(ruta))!);

    expect(texto).toContain('ARS 9.500,00');
    expect(texto).not.toContain('7777');
  });

  // RF-14 pide expressly "cancha, horario y monto": los tres tienen que estar.
  it('lleva cancha, horario y monto de la reserva', async () => {
    const { service } = armar();

    const ruta = await service.generar(pago(), RESERVA_CANCHA as ConceptoPago);
    const texto = textoDelPdf((await service.leer(ruta))!);

    expect(texto).toContain('Comprobante de pago');
    expect(texto).toContain('Cancha:');
    expect(texto).toContain('N° 3');
    expect(texto).toContain('Horario:');
    // Hora local de la sede (ART = UTC-3): 14:00Z y 15:00Z son 11:00 y 12:00.
    expect(texto).toContain('2026-10-10 11:00');
    expect(texto).toContain('2026-10-10 12:00');
    expect(texto).toContain('Pago:');
    expect(texto).toContain('#8');
  });

  it('imprime el plan cuando el concepto es una membresía', async () => {
    const { service } = armar();

    const ruta = await service.generar(pago({ monto: 30000, concepto: MEMBRESIA }), MEMBRESIA);
    const texto = textoDelPdf((await service.leer(ruta))!);

    expect(texto).toContain('Membresía');
    expect(texto).toContain('MENSUAL');
    expect(texto).toContain('ARS 30.000,00');
    expect(texto).not.toContain('Cancha:');
  });

  // RF-07: la penalidad por cancelacion tardia imprime su detalle (clase, horario).
  it('imprime la penalidad de una reserva de clase (RF-07)', async () => {
    const { service } = armar();

    const ruta = await service.generar(pago({ monto: 5000, concepto: RESERVA_CLASE }), RESERVA_CLASE);
    const texto = textoDelPdf((await service.leer(ruta))!);

    expect(texto).toContain('Reserva de clase');
    expect(texto).toContain('Clase:');
    expect(texto).toContain('N° 9');
    expect(texto).toContain('Horario:');
    expect(texto).toContain('Penalidad por cancelación tardía');
    expect(texto).toContain('ARS 5.000,00');
  });

  // RF-02 (historial): el comprobante imprime nombre y email del socio, resueltos al
  // momento del cobro. Es el snapshot de identidad que sobrevive aunque después se
  // borre el socio (el PDF es autosuficiente y no depende de las filas).
  it('imprime nombre y email del socio en la cabeza del comprobante', async () => {
    const { service } = armar();

    const ruta = await service.generar(pago(), RESERVA_CANCHA as ConceptoPago);
    const texto = textoDelPdf((await service.leer(ruta))!);

    expect(texto).toContain('Ana Gómez');
    expect(texto).toContain('ana@fitzone.com');
  });

it('imprime "no disponible" si el usuario no existe, sin cortar el PDF', async () => {
    const { service, usuarios } = armar();
    usuarios.buscarDatosParaComprobante.mockResolvedValue(null);

    const ruta = await service.generar(pago(), RESERVA_CANCHA as ConceptoPago);
    const texto = textoDelPdf((await service.leer(ruta))!);

    expect(texto).toContain('no disponible');
    expect(texto).toContain('ARS 9.500,00');
  });

  it('devuelve null al leer un archivo que no está, en vez de romper', async () => {
    const { service } = armar();

    await expect(service.leer(`${RUTA_COMPROBANTES}/999.pdf`)).resolves.toBeNull();
  });

  // Es la razón de que `rutaAbsolutaDe()` se quede con el nombre del archivo: la columna
  // es de datos internos, pero un `../` en ella leería cualquier archivo del disco.
  it('ignora los directorios que vengan en la ruta guardada', async () => {
    const { service } = armar();
    await service.generar(pago(), RESERVA_CANCHA as ConceptoPago);

    const bytes = await service.leer('../../../../etc/passwd/8.pdf');

    expect(bytes!.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('sobrescribe el archivo si se regenera el mismo pago', async () => {
    const { service } = armar();

    const primera = await service.generar(pago(), RESERVA_CANCHA as ConceptoPago);
    const segunda = await service.generar(pago({ monto: 12345 }), RESERVA_CANCHA as ConceptoPago);

    expect(segunda).toBe(primera);
    const texto = textoDelPdf((await service.leer(segunda))!);
    expect(texto).toContain('ARS 12.345,00');
    expect(texto).not.toContain('9.500');
  });

  // No debería pasar (el cobro ya validó que el concepto existe), pero si pasa el PDF
  // tiene que salir entero: cortarlo a mitad de escritura dejaría un comprobante
  // corrupto, que es peor que uno sin detalle.
  it('igual genera un PDF si el concepto ya no está', async () => {
    const { service } = armar({ reserva: null });

    const ruta = await service.generar(pago(), RESERVA_CANCHA as ConceptoPago);
    const bytes = await service.leer(ruta);

    expect(bytes!.subarray(0, 5).toString()).toBe('%PDF-');
    expect(textoDelPdf(bytes!)).toContain('no disponible');
  });
});