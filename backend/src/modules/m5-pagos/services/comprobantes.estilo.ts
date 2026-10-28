import type { Pago } from '../entities/pago.entity';

/**
 * Diseño del comprobante PDF: colores, medidas y los helpers que dibujan las piezas
 * repetidas (título de sección, fila etiqueta/valor, badge de estado y recuadro del
 * monto). Vive aparte de `comprobantes.service.ts` para que el service se quede con
 * QUÉ se imprime y este archivo con CÓMO se ve.
 *
 * Todas las posiciones son explícitas (nada de `continued`): cada helper deja el cursor
 * en `x = MARGEN` y en `y` justo debajo de lo que dibujó, así el siguiente arranca limpio.
 */

type Documento = PDFKit.PDFDocument;

// Paleta de la marca. Los tests leen el TEXTO del PDF (`compress: false`), así que el
// color no afecta las aserciones.
export const COLOR_CABECERA = '#0e3a5d';
export const COLOR_TITULO = '#111111';
export const COLOR_ETIQUETA = '#5a6b7b';
export const COLOR_PIE = '#8a97a3';
const COLOR_APROBADO = '#2e7d32';
const COLOR_OTRO_ESTADO = '#b26a00';
const COLOR_SEPARADOR = '#e3e8ed';
const COLOR_FONDO_MONTO = '#eef3f8';

// Medidas en puntos (A4: 595,28 x 841,89).
export const MARGEN = 50;
const X_VALOR = 190;
const ALTO_FILA = 24;
const SEPARACION_SECCIONES = 22;
const Y_BADGE = 28;
const ALTO_BADGE = 24;
const ALTO_MONTO = 46;
const RADIO_MONTO = 6;
const SEPARACION_PIE = 36;

const anchoUtil = (doc: Documento) => doc.page.width - 2 * MARGEN;

// Primera letra en mayúscula y el resto en minúscula ("APROBADO" -> "Aprobado"). Es genérica a
// propósito: sirve para cualquier valor de un enum, incluso uno que se agregue mañana.
export function capitalizar(texto: string): string {
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1).toLowerCase()}`;
}

// "Estado: Aprobado", derivado del enum (APROBADO, PENDIENTE, RECHAZADO, ANULADO) y no de un mapa por estado.
export function textoDelEstado(estado: Pago['estado']): string {
  return `Estado: ${capitalizar(estado)}`;
}

// El plan de la membresía como se lee en un papel: "Mensual", "Trimestral", "Anual".
export function etiquetaDelPlan(plan: string): string {
  return capitalizar(plan);
}

/**
 * Chip redondeado en la esquina derecha de la banda de marca. Alto 24 y bordes totalmente
 * redondeados (radio = alto / 2); el texto se centra en los dos ejes: a lo ancho con
 * `align: 'center'` y a lo alto con la altura real de la línea, no con un valor a ojo.
 */
export function dibujarBadge(doc: Documento, estado: Pago['estado']): void {
  const texto = textoDelEstado(estado);
  const color = estado === 'APROBADO' ? COLOR_APROBADO : COLOR_OTRO_ESTADO;

  doc.font('Helvetica').fontSize(9);
  const ancho = doc.widthOfString(texto) + 28;
  const x = doc.page.width - ancho - MARGEN;

  doc.roundedRect(x, Y_BADGE, ancho, ALTO_BADGE, ALTO_BADGE / 2).fill(color);
  const yTexto = Y_BADGE + (ALTO_BADGE - doc.currentLineHeight()) / 2;
  doc.fillColor('#ffffff').text(texto, x, yTexto, { width: ancho, align: 'center', lineBreak: false });

  // Después de escribir en la esquina derecha el cursor queda ahí: sin este reset, lo
  // que siga se dibujaría pegado al borde derecho y partido en dos líneas.
  doc.x = MARGEN;
}

// Título de sección en negrita de marca, con la barra de acento de 26x3 DEBAJO (no sobre el
// texto: `doc.y` recién bajó del título y dibujar más arriba tapa la línea).
export function dibujarTitulo(doc: Documento, texto: string): void {
  doc.fillColor(COLOR_CABECERA).font('Helvetica-Bold').fontSize(13).text(texto, MARGEN, doc.y);
  doc.rect(MARGEN, doc.y + 3, 26, 3).fill(COLOR_CABECERA);
  doc.x = MARGEN;
  doc.y += 3 + 3 + 10;
}

// El aire entre el último dato de una sección y el título de la siguiente.
export function separarSecciones(doc: Documento): void {
  doc.y += SEPARACION_SECCIONES;
}

/**
 * Una fila de dos columnas: la etiqueta (con ":") en `x = MARGEN` y el valor en `x = X_VALOR`,
 * que puede envolver si es largo sin pisar la etiqueta. ~24 pt de alto (más si el valor ocupa
 * varias líneas) y una línea fina debajo, de borde a borde del margen.
 */
export function dibujarFila(doc: Documento, etiqueta: string, valor: string): void {
  const y = doc.y;
  const anchoValor = anchoUtil(doc) - (X_VALOR - MARGEN);

  doc.font('Helvetica').fontSize(10);
  const relleno = (ALTO_FILA - doc.currentLineHeight()) / 2;
  const alto = Math.max(ALTO_FILA, doc.heightOfString(valor, { width: anchoValor }) + 2 * relleno);

  doc.fillColor(COLOR_ETIQUETA).text(`${etiqueta}:`, MARGEN, y + relleno, {
    width: X_VALOR - MARGEN - 8,
    lineBreak: false,
  });
  doc.fillColor(COLOR_TITULO).text(valor, X_VALOR, y + relleno, { width: anchoValor });

  doc
    .moveTo(MARGEN, y + alto)
    .lineTo(doc.page.width - MARGEN, y + alto)
    .lineWidth(0.5)
    .strokeColor(COLOR_SEPARADOR)
    .stroke();

  doc.x = MARGEN;
  doc.y = y + alto;
}

/**
 * El monto, al final, en un recuadro redondeado de todo el ancho del margen: la etiqueta a la
 * izquierda y el importe a la derecha, en negrita grande de marca. Los dos se centran a lo alto
 * con la altura real de su línea (como el badge).
 */
export function dibujarMonto(doc: Documento, importe: string): void {
  doc.y += SEPARACION_SECCIONES;
  const y = doc.y;
  const ancho = anchoUtil(doc);
  const relleno = 16;

  doc.roundedRect(MARGEN, y, ancho, ALTO_MONTO, RADIO_MONTO).fill(COLOR_FONDO_MONTO);

  doc.font('Helvetica').fontSize(10).fillColor(COLOR_ETIQUETA);
  doc.text('Monto', MARGEN + relleno, y + (ALTO_MONTO - doc.currentLineHeight()) / 2, { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(17).fillColor(COLOR_CABECERA);
  doc.text(importe, MARGEN, y + (ALTO_MONTO - doc.currentLineHeight()) / 2, {
    width: ancho - relleno,
    align: 'right',
    lineBreak: false,
  });

  doc.x = MARGEN;
  doc.y = y + ALTO_MONTO;
}

// El pie se cierra con una línea fina para dejar la página "terminada" visualmente.
export function dibujarPie(doc: Documento, texto: string): void {
  doc.y += SEPARACION_PIE;
  doc
    .moveTo(MARGEN, doc.y)
    .lineTo(doc.page.width - MARGEN, doc.y)
    .lineWidth(0.5)
    .strokeColor(COLOR_PIE)
    .stroke();
  doc.y += 8;
  doc.font('Helvetica').fontSize(8).fillColor(COLOR_PIE).text(texto, MARGEN, doc.y, { align: 'center' });
}
