import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { MembresiaPrecioService } from 'src/modules/m1-usuarios/services/membresia-precio.service';
import type { UsuariosService } from 'src/modules/m1-usuarios/services/usuarios.service';
import type { ReservaClasePrecioService } from 'src/modules/m3-clases/services/reserva-clase-precio.service';
import type { ReservaPrecioService } from 'src/modules/m4-canchas/services/reserva-precio.service';
import type { ConceptoPago, Pago } from 'src/modules/m5-pagos/entities/pago.entity';
import { ComprobantesService } from 'src/modules/m5-pagos/services/comprobantes.service';

/**
 * MUESTRAS PARA VER EL DISEÑO DEL COMPROBANTE (no es un test de verdad).
 *
 * Genera seis PDF de ejemplo en `backend/storage/comprobantes/muestras/` para abrirlos a la
 * vista, sin pagar nada en la app y sin usar la base de datos. Usa el mismo armado de PDF que
 * el servicio real, con datos inventados en lugar de las consultas a la base.
 *
 * Solo corre si existe la variable de entorno `MUESTRAS_COMPROBANTE=1`. En una corrida normal
 * de `npm run test:unit` se saltea y no escribe nada.
 *
 *   PowerShell:  $env:MUESTRAS_COMPROBANTE="1"; npx vitest run --config vitest.unit.config.ts src/modules/m5-pagos/services/comprobantes.muestras.spec.ts
 *   Git Bash:    MUESTRAS_COMPROBANTE=1 npx vitest run --config vitest.unit.config.ts src/modules/m5-pagos/services/comprobantes.muestras.spec.ts
 */
const HABILITADO = process.env.MUESTRAS_COMPROBANTE === '1';
const DIRECTORIO = join(process.cwd(), 'storage', 'comprobantes', 'muestras');

const INICIO = new Date('2026-12-05T20:00:00.000Z');
const FIN = new Date('2026-12-05T21:00:00.000Z');

const RESERVA_CANCHA = { tipo: 'RESERVA_CANCHA', reservaCanchaId: 12 } as ConceptoPago;
const RESERVA_CLASE = { tipo: 'RESERVA_CLASE', reservaClaseId: 3 } as ConceptoPago;
const MEMBRESIA = { tipo: 'MEMBRESIA', membresiaId: 5 } as ConceptoPago;

function pago(over: Partial<Pago> = {}): Pago {
  return {
    id: 130,
    usuarioId: 9,
    concepto: RESERVA_CANCHA,
    monto: 7650,
    moneda: 'ARS',
    estado: 'APROBADO',
    fechaPago: new Date('2026-10-27T23:18:00.000Z'),
    comprobantePdfUrl: null,
    token: 'tok_aprobado_1',
    idempotenciaKey: 'clave-muestra',
    ...over,
  };
}

function armar(over: { reserva?: unknown; usuario?: unknown } = {}) {
  const reservas = {
    obtenerParaCobro: vi.fn().mockResolvedValue(
      over.reserva === undefined
        ? { reservaId: 12, usuarioId: 9, canchaId: 3, fechaHoraInicio: INICIO, fechaHoraFin: FIN, precio: 7650, estado: 'CONFIRMADA' }
        : over.reserva,
    ),
  };
  const membresias = {
    obtenerParaCobro: vi.fn().mockResolvedValue({ membresiaId: 5, usuarioId: 9, plan: 'MENSUAL', precio: 30000, estado: 'ACTIVA' }),
  };
  const reservasClases = {
    obtenerParaCobro: vi.fn().mockResolvedValue({
      reservaClaseId: 3,
      socioId: 9,
      usuarioId: 9,
      claseId: 9,
      horarioInicio: '2026-12-05T20:00:00.000Z',
      penalidad: 5000,
    }),
  };
  const usuarios = {
    buscarDatosParaComprobante: vi
      .fn()
      .mockResolvedValue(
        over.usuario === undefined ? { nombre: 'Santino Mazzulla', email: 'mazzullasantino85@gmail.com' } : over.usuario,
      ),
  };
  return new ComprobantesService(
    reservas as unknown as ReservaPrecioService,
    membresias as unknown as MembresiaPrecioService,
    reservasClases as unknown as ReservaClasePrecioService,
    usuarios as unknown as UsuariosService,
  );
}

const MUESTRAS: { archivo: string; descripcion: string; armar: () => Promise<Buffer> }[] = [
  {
    archivo: 'muestra-cancha.pdf',
    descripcion: 'pago aprobado de una reserva de cancha',
    armar: () => armar().armarPdf(pago(), RESERVA_CANCHA),
  },
  {
    archivo: 'muestra-clase.pdf',
    descripcion: 'penalidad por cancelar una clase tarde',
    armar: () => armar().armarPdf(pago({ id: 131, monto: 5000, concepto: RESERVA_CLASE }), RESERVA_CLASE),
  },
  {
    archivo: 'muestra-membresia.pdf',
    descripcion: 'pago de una membresía',
    armar: () => armar().armarPdf(pago({ id: 132, monto: 30000, concepto: MEMBRESIA }), MEMBRESIA),
  },
  {
    archivo: 'muestra-datos-largos.pdf',
    descripcion: 'nombre y email muy largos (tienen que envolver sin pisar la etiqueta)',
    armar: () =>
      armar({
        usuario: {
          nombre: 'María de los Ángeles Fernández Rodríguez de la Vega y Pérez Gutiérrez de Santa Cruz',
          email: 'maria.de.los.angeles.fernandez.rodriguez.de.la.vega.y.perez.gutierrez@una-universidad-con-un-dominio-muy-largo.edu.ar',
        },
      }).armarPdf(pago({ id: 133 }), RESERVA_CANCHA),
  },
  {
    archivo: 'muestra-pendiente.pdf',
    descripcion: 'pago pendiente (badge de otro color)',
    armar: () => armar().armarPdf(pago({ id: 134, estado: 'PENDIENTE' }), RESERVA_CANCHA),
  },
  {
    archivo: 'muestra-no-disponible.pdf',
    descripcion: 'la reserva no se encuentra',
    armar: () => armar({ reserva: null }).armarPdf(pago({ id: 135 }), RESERVA_CANCHA),
  },
];

describe.skipIf(!HABILITADO)('Muestras del comprobante (solo con MUESTRAS_COMPROBANTE=1)', () => {
  it('genera los PDF de ejemplo y muestra dónde quedaron', async () => {
    await mkdir(DIRECTORIO, { recursive: true });

    for (const muestra of MUESTRAS) {
      const ruta = join(DIRECTORIO, muestra.archivo);
      const bytes = await muestra.armar();
      await writeFile(ruta, bytes);
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      console.log(`${ruta}  (${muestra.descripcion})`);
    }
  });
});
