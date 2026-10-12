import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import { aFechaLocal } from '../../../commons/fechas';
import type { ReporteIngresos } from '../../m5-pagos/services/reporte-ingresos.service';

// Misma paleta que el comprobante (comprobantes.service.ts): banda de marca azul,
// etiquetas grises y pie tenue.
const COLOR_CABECERA = '#0e3a5d';
const COLOR_TITULO = '#111111';
const COLOR_ETIQUETA = '#5a6b7b';
const COLOR_PIE = '#8a97a3';
const COLOR_FILA_ALTERNA = '#eef3f7';

const MARGEN = 50;
// Columnas de la tabla: x de inicio y ancho. El monto va alineado a la derecha.
const COLUMNAS = {
  fecha: { x: MARGEN, ancho: 85 },
  sede: { x: 135, ancho: 170 },
  concepto: { x: 305, ancho: 125 },
  total: { x: 430, ancho: 115 },
} as const;
const ALTO_FILA = 20;

/**
 * Arma el PDF del reporte de ingresos (Unidad IV). A diferencia del comprobante, que es
 * un snapshot persistido, el reporte no se guarda en disco: se devuelve el Buffer.
 */
@Injectable()
export class ReportesService {
  armarPdf(reporte: ReporteIngresos, rango: { desde?: Date; hasta?: Date }): Buffer {
    // Sin compresión para poder assertar el texto en los tests (ver comprobantes.service).
    const doc = new PDFDocument({ size: 'A4', margin: MARGEN, compress: false });
    this.cabeza(doc, rango);
    this.tabla(doc, reporte);
    this.pie(doc, reporte);
    doc.end();

    // pdfkit es un Readable: sin listener 'data' no entra en modo flujo y `end()` deja todo
    // el documento en el buffer interno, así que se lee de forma síncrona (con 'data' los
    // trozos llegarían en el próximo tick y `armarPdf` no podría devolver un Buffer).
    const trozos: Buffer[] = [];
    for (let trozo = doc.read(); trozo !== null; trozo = doc.read()) {
      trozos.push(trozo as Buffer);
    }
    return Buffer.concat(trozos);
  }

  private cabeza(doc: PDFKit.PDFDocument, rango: { desde?: Date; hasta?: Date }): void {
    doc.rect(0, 0, doc.page.width, 78).fill(COLOR_CABECERA);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('FitZone Sports', MARGEN, 20);
    doc.font('Helvetica').fontSize(11).text('Reporte de ingresos', MARGEN, 48);

    doc.y = 96;
    doc.font('Helvetica').fillColor(COLOR_ETIQUETA).fontSize(10).text('Período: ', MARGEN, doc.y, {
      continued: true,
    });
    doc.fillColor(COLOR_TITULO).text(this.periodo(rango));
    doc.moveDown(1);
  }

  private tabla(doc: PDFKit.PDFDocument, reporte: ReporteIngresos): void {
    this.encabezadoTabla(doc);

    if (reporte.filas.length === 0) {
      doc.font('Helvetica').fillColor(COLOR_ETIQUETA).fontSize(10);
      doc.text('Sin pagos aprobados en el período.', MARGEN, doc.y + 6);
      doc.y += ALTO_FILA;
    }

    reporte.filas.forEach((fila, i) => {
      this.saltoSiHaceFalta(doc);
      const y = doc.y;
      if (i % 2 === 1) {
        doc.rect(MARGEN, y - 4, doc.page.width - 2 * MARGEN, ALTO_FILA).fill(COLOR_FILA_ALTERNA);
      }
      doc.font('Helvetica').fillColor(COLOR_TITULO).fontSize(10);
      this.celdas(doc, y, [fila.fechaLocal, fila.sedeNombre, fila.tipo, this.pesos(fila.monto)]);
      doc.y = y + ALTO_FILA;
    });

    // Fila de totales.
    this.saltoSiHaceFalta(doc);
    const y = doc.y + 4;
    doc.moveTo(MARGEN, y - 6).lineTo(doc.page.width - MARGEN, y - 6).lineWidth(0.8).strokeColor(COLOR_CABECERA).stroke();
    doc.font('Helvetica-Bold').fillColor(COLOR_CABECERA).fontSize(11);
    this.celdas(doc, y, ['Total general', '', '', this.pesos(reporte.total)]);
    doc.y = y + ALTO_FILA;
  }

  private encabezadoTabla(doc: PDFKit.PDFDocument): void {
    const y = doc.y;
    doc.rect(MARGEN, y - 4, doc.page.width - 2 * MARGEN, ALTO_FILA).fill(COLOR_CABECERA);
    doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(10);
    this.celdas(doc, y, ['Fecha', 'Sede', 'Concepto', 'Total']);
    doc.y = y + ALTO_FILA + 2;
  }

  private celdas(doc: PDFKit.PDFDocument, y: number, [fecha, sede, concepto, total]: string[]): void {
    doc.text(fecha, COLUMNAS.fecha.x, y, { width: COLUMNAS.fecha.ancho, lineBreak: false });
    doc.text(sede, COLUMNAS.sede.x, y, { width: COLUMNAS.sede.ancho, lineBreak: false, ellipsis: true });
    doc.text(concepto, COLUMNAS.concepto.x, y, { width: COLUMNAS.concepto.ancho, lineBreak: false });
    doc.text(total, COLUMNAS.total.x, y, { width: COLUMNAS.total.ancho, align: 'right', lineBreak: false });
  }

  // Deja lugar para la fila y el pie; si no entra, página nueva con el encabezado repetido.
  private saltoSiHaceFalta(doc: PDFKit.PDFDocument): void {
    if (doc.y + ALTO_FILA > doc.page.height - 90) {
      doc.addPage();
      doc.y = MARGEN;
      this.encabezadoTabla(doc);
    }
  }

  private pie(doc: PDFKit.PDFDocument, reporte: ReporteIngresos): void {
    doc.y += 10;
    this.saltoSiHaceFalta(doc);
    doc.moveTo(MARGEN, doc.y).lineTo(doc.page.width - MARGEN, doc.y).lineWidth(0.5).strokeColor(COLOR_PIE).stroke();
    doc.moveDown(0.4);
    const huerfanos =
      reporte.huerfanos > 0 ? ` ${reporte.huerfanos} pago(s) sin sede resuelta fueron descartados.` : '';
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLOR_PIE)
      .text(
        `Reporte generado ${this.ahora()} (solo pagos APROBADO).${huerfanos}`,
        MARGEN,
        doc.y,
        { align: 'center', width: doc.page.width - 2 * MARGEN },
      );
  }

  // `hasta` llega como instante exclusivo (inicio del día siguiente): el último día
  // incluido es el local del instante anterior.
  private periodo({ desde, hasta }: { desde?: Date; hasta?: Date }): string {
    if (!desde && !hasta) return 'histórico';
    const ini = desde ? aFechaLocal(desde) : 'inicio';
    const fin = hasta ? aFechaLocal(new Date(hasta.getTime() - 1)) : 'hoy';
    return `${ini} a ${fin}`;
  }

  private ahora(): string {
    return aFechaLocal(new Date());
  }

  private pesos(monto: number): string {
    return `ARS ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
