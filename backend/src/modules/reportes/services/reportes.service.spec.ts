import { describe, expect, it } from 'vitest';
import type { ReporteIngresos } from 'src/modules/m5-pagos/services/reporte-ingresos.service';
import { ReportesService } from 'src/modules/reportes/services/reportes.service';

// Lector hex de comprobantes.service.spec: pdfkit escribe cada texto como hex dentro del
// content stream, y los hex se pegan SIN separador porque el kerning parte las palabras.
function textoDelPdf(buffer: Buffer): string {
  return (buffer.toString('latin1').match(/<([0-9a-fA-F]+)>/g) ?? [])
    .map((m) => m.slice(1, -1))
    .map((hex) =>
      (hex.match(/../g) ?? []).map((byte) => String.fromCharCode(parseInt(byte, 16))).join(''),
    )
    .join('');
}

const REPORTE: ReporteIngresos = {
  filas: [
    { fechaLocal: '2026-10-08', sedeId: 1, sedeNombre: 'Sede Centro', tipo: 'RESERVA_CANCHA', monto: 7750 },
    { fechaLocal: '2026-10-08', sedeId: 1, sedeNombre: 'Sede Centro', tipo: 'MEMBRESIA', monto: 30000 },
  ],
  total: 37750,
  huerfanos: 0,
};

describe('ReportesService.armarPdf', () => {
  const service = new ReportesService();

  it('produce un PDF válido', () => {
    const pdf = service.armarPdf(REPORTE, {});

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('imprime el período, las filas y el total general', () => {
    const pdf = service.armarPdf(REPORTE, {
      desde: new Date('2026-10-08T03:00:00.000Z'),
      hasta: new Date('2026-10-10T03:00:00.000Z'),
    });
    const texto = textoDelPdf(pdf);

    expect(texto).toContain('FitZone Sports');
    expect(texto).toContain('Reporte de ingresos');
    // `hasta` es exclusivo: el último día incluido es el 9.
    expect(texto).toContain('2026-10-08 a 2026-10-09');
    expect(texto).toContain('Sede Centro');
    expect(texto).toContain('Reserva de cancha');
    expect(texto).toContain('7.750,00');
    expect(texto).toContain('Total general');
    expect(texto).toContain('37.750,00');
    expect(texto).toContain('Reporte generado');
  });

  it('imprime una etiqueta legible por concepto, no el valor del enum', () => {
    const reporte: ReporteIngresos = {
      filas: [
        { fechaLocal: '2026-10-08', sedeId: 1, sedeNombre: 'Sede Centro', tipo: 'RESERVA_CANCHA', monto: 100 },
        { fechaLocal: '2026-10-08', sedeId: 1, sedeNombre: 'Sede Centro', tipo: 'MEMBRESIA', monto: 200 },
        { fechaLocal: '2026-10-08', sedeId: 1, sedeNombre: 'Sede Centro', tipo: 'RESERVA_CLASE', monto: 300 },
      ],
      total: 600,
      huerfanos: 0,
    };
    const texto = textoDelPdf(service.armarPdf(reporte, {}));

    expect(texto).toContain('Reserva de cancha');
    expect(texto).toContain('Membresía');
    expect(texto).toContain('Penalidad de clase');
    for (const crudo of ['RESERVA_CANCHA', 'MEMBRESIA', 'RESERVA_CLASE']) expect(texto).not.toContain(crudo);
  });

  it('el pie dice "Reporte generado AAAA-MM-DD." sin la aclaración de pagos aprobados', () => {
    const texto = textoDelPdf(service.armarPdf(REPORTE, {}));

    expect(texto).toMatch(/Reporte generado \d{4}-\d{2}-\d{2}\./);
    expect(texto).not.toContain('solo pagos');
    expect(texto).not.toContain('APROBADO');
  });

  it('sin rango dice histórico', () => {
    expect(textoDelPdf(service.armarPdf(REPORTE, {}))).toContain('histórico');
  });

  it('un reporte vacío igual se arma y muestra total 0', () => {
    const texto = textoDelPdf(service.armarPdf({ filas: [], total: 0, huerfanos: 2 }, {}));

    expect(texto).toContain('Sin pagos aprobados');
    expect(texto).toContain('0,00');
    expect(texto).toContain('2 pago(s) sin sede');
  });

  it('pagina cuando hay muchas filas y conserva el total general', () => {
    const filas = Array.from({ length: 80 }, (_, i) => ({
      fechaLocal: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
      sedeId: i,
      sedeNombre: `Sede ${i}`,
      tipo: 'MEMBRESIA' as const,
      monto: 100,
    }));
    const pdf = service.armarPdf({ filas, total: 8000, huerfanos: 0 }, {});

    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
    expect(textoDelPdf(pdf)).toContain('8.000,00');
  });
});
