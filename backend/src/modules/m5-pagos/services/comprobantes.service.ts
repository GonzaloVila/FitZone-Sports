import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import { ReservaPrecioService } from '../../m4-canchas/services/reserva-precio.service';
import { ConceptoPago, Pago } from '../entities/pago.entity';

/**
 * FRONTERA (RF-14): arma el PDF y lo deja escrito en disco.
 *
 * La librería concreta entra acá y no se filtra: el service expone `Buffer` y ruta
 * pública, nunca un `PDFDocument`. Cambiar de librería es cambiar este archivo, y
 * `PagosService` no se entera. Es la misma frontera que `PasarelaPagoService`, pero
 * del lado interno: esta no habla con nadie de afuera: pdfkit no hace red.
 *
 * Las dos fronteras externas de M5 están separadas a propósito y se parecen en poco:
 * esta es determinista y local, la pasarela es el mock de MercadoPago/Modo.
 */

/**
 * Lo que va en `Pago.comprobante_pdf_url` y dónde viven los archivos.
 *
 * La columna guarda la ruta *pública* del archivo (`/storage/comprobantes/8.pdf`) y no
 * un `file://` de esta máquina: si mañana el PDF pasa a un bucket, la columna ya
 * contiene la clave del objeto y no hay que backmigrar rutas absolutas.
 *
 * Que sea disco local no significa que sea servible. El directorio NO es público ni se
 * expone con `ServeStatic`: el PDF solo se baja por `GET /pagos/{id}/comprobante`,
 * que antes valida que el pago esté aprobado. Un comprobante de cobro no debería ser
 * adivinable por quien sepa el id.
 */
export const RUTA_COMPROBANTES = '/storage/comprobantes';
const DIRECTORIO_COMPROBANTES = 'storage/comprobantes';

@Injectable()
export class ComprobantesService {
  constructor(
    private readonly reservas: ReservaPrecioService,
    private readonly membresias: MembresiaPrecioService,
  ) {}

  /**
   * Genera el comprobante de un pago ya aprobado y lo deja escrito. Devuelve la ruta
   * pública para que el caller la persista en `comprobante_pdf_url`.
   *
   * La firma es la del plan —`generar(pago, concepto)`— y por eso este service resuelve
   * otra vez el concepto que `PagosService` ya había leído para el precio. Es una segunda
   * lectura de la misma fila (PK, sub-milisegundo) a cambio de que la firma no tenga que
   * recibir una unión de dos tipos de dos módulos distintos. Lo que el PDF imprime de
   * verdad —el monto— sale de `pago.monto`, que ya viene congelado: el importe NO se
   * recalcula acá.
   */
  async generar(pago: Pago, concepto: ConceptoPago): Promise<string> {
    const nombre = `${pago.id}.pdf`;
    const rutaAbsoluta = join(process.cwd(), DIRECTORIO_COMPROBANTES, nombre);

    await mkdir(join(process.cwd(), DIRECTORIO_COMPROBANTES), { recursive: true });
    await writeFile(rutaAbsoluta, await this.armarPdf(pago, concepto));

    return `${RUTA_COMPROBANTES}/${nombre}`;
  }

  /**
   * Lee el PDF ya generado, o `null` si el archivo no está.
   *
   * NO lo vuelve a armar, y esa es toda la razón de que `comprobante_pdf_url` exista:
   * es un snapshot del momento del cobro (punto 2 del bloque 3). Regenerarlo en cada
   * request haría que un comprobante ya emitido cambiara si después cambió el horario de
   * la cancha o la tarifa, que es justo lo que un comprobante no puede hacer —la misma
   * razón por la que M4 congela `precio_aplicado`.
   *
   * `null` en vez de propagar el ENOENT: el archivo puede no estar (por ejemplo si se
   * limpió `storage/`), y eso es un 404 del contrato, no un 500 por error de Node.
   */
  async leer(rutaPublica: string): Promise<Buffer | null> {
    try {
      return await readFile(this.rutaAbsolutaDe(rutaPublica));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  // --------------------------------------------------------------------------------------
  // Armado del PDF
  // --------------------------------------------------------------------------------------

  private async armarPdf(pago: Pago, concepto: ConceptoPago): Promise<Buffer> {
    // pdfkit es un stream: se le escriben trozos y se escucha `end`. Por eso el Buffer
    // se acumula a mano en vez de usar `doc.pipe()`, que escribiría directo a un archivo y
    // no dejaría revisar el resultado antes de tocar disco.
    return new Promise<Buffer>((resolve, reject) => {
      // Sin compresión: el archivo pesa un poco más y a cambio el texto del comprobante se
      // puede leer y verificar (los tests comprueban que el monto impreso sea el congelado, y
      // con streams comprimidos no se puede assertar nada del contenido). Para un ticket de
      // una hoja, el tamaño no es un problema; la ofuscación del PDF no aporta nada acá.
      const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
      const trozos: Buffer[] = [];
      doc.on('data', (trozo: Buffer) => trozos.push(trozo));
      doc.on('end', () => resolve(Buffer.concat(trozos)));
      doc.on('error', reject);

      this.cabeza(doc, pago);

      // El detalle se arma con `await` porque resolver el concepto pega contra M1/M4. Por
      // eso `doc.end()` va después de la promesa y no junto a la llamada: cerrarlo antes
      // de que termine el detalle produciría un PDF truncado o vacío en silencio.
      this.detalle(doc, concepto)
        .then(() => this.pie(doc))
        .then(() => doc.end())
        .catch(reject);
    });
  }

  private cabeza(doc: PDFKit.PDFDocument, pago: Pago): void {
    doc.fontSize(20).fillColor('#111111').text('FitZone Sports');
    doc.moveDown(0.2);
    doc.fontSize(12).text('Comprobante de pago');
    doc.moveDown();

    doc.fontSize(10);
    this.linea(doc, 'Pago', `#${pago.id}`);
    this.linea(doc, 'Fecha', pago.fecha_pago.toISOString());
    this.linea(doc, 'Usuario', `#${pago.usuario_id}`);
    this.linea(doc, 'Estado', pago.estado);
    this.linea(doc, 'Monto', this.pesos(pago.monto, pago.moneda));
    doc.moveDown();
  }

  /**
   * RF-14 pide "cancha, horario y monto". El monto ya salió arriba; acá va el detalle de
   * qué se cobró, que es lo que hace que el comprobante sea comprobante y no un recibo.
   */
  private async detalle(doc: PDFKit.PDFDocument, concepto: ConceptoPago): Promise<void> {
    doc.fontSize(14).fillColor('#111111').text('Detalle');

    if (concepto.tipo === 'RESERVA_CANCHA') {
      const reserva = await this.reservas.obtenerParaCobro(concepto.reserva_cancha_id);
      if (!reserva) {
        // No debería pasar: el cobro ya validó que la reserva existe y las reservas no se
        // borran. Si igual pasa, sale un PDF sin detalle en vez de cortarse a mitad de
        // escritura, que dejaría un archivo corrupto y un comprobante inútil.
        doc.fontSize(11).text(`Reserva ${concepto.reserva_cancha_id} (no disponible).`);
        return;
      }

      this.linea(doc, 'Concepto', 'Reserva de cancha');
      this.linea(doc, 'Cancha', `N° ${reserva.cancha_id}`);
      this.linea(
        doc,
        'Horario',
        `${reserva.fecha_hora_inicio.toISOString()} - ${reserva.fecha_hora_fin.toISOString()}`,
      );
      this.linea(doc, 'Reserva', `#${reserva.reserva_id}`);
      return;
    }

    const membresia = await this.membresias.obtenerParaCobro(concepto.membresia_id);
    if (!membresia) {
      doc.fontSize(11).text(`Membresía ${concepto.membresia_id} (no disponible).`);
      return;
    }

    this.linea(doc, 'Concepto', 'Membresía');
    this.linea(doc, 'Plan', membresia.plan);
    this.linea(doc, 'Membresía', `#${membresia.membresia_id}`);
  }

  // El PDF tiene que dejar constancia de que es una copia: el snapshot conserva lo que se
  // cobró, y después de una anulación el archivo sigue siendo el comprobante del cobro
  // que ocurrió. Por eso dice "generado al cobrar" y no "válido" ni "emitido hoy".
  private pie(doc: PDFKit.PDFDocument): void {
    doc.moveDown();
    doc
      .fontSize(8)
      .fillColor('#777777')
      .text('Documento generado al momento del cobro.', { align: 'center' });
  }

  private linea(doc: PDFKit.PDFDocument, etiqueta: string, valor: string): void {
    doc.fillColor('#555555').fontSize(10).text(`${etiqueta}: `, { continued: true });
    doc.fillColor('#111111').text(valor);
  }

  // `Intl` y no un `toFixed` con signo: el monto viene de `Decimal` de Prisma y puede
  // traer decimales; el símbolo va explícito porque el PDF no depende del locale del
  // servidor para leerse bien.
  private pesos(monto: number, moneda: string): string {
    return `${moneda} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  }

  // --------------------------------------------------------------------------------------
  // Rutas
  // --------------------------------------------------------------------------------------

  private rutaAbsolutaDe(rutaPublica: string): string {
    // Solo se acepta el nombre del archivo que esta misma clase escribió: se toma lo que
    // hay después del último `/` y se descarta cualquier directorio que venga en la
    // columna. Sin esto, un `comprobante_pdf_url` con `../` leería un archivo de
    // cualquier parte del disco.
    const nombre = rutaPublica.slice(rutaPublica.lastIndexOf('/') + 1);
    return join(process.cwd(), DIRECTORIO_COMPROBANTES, nombre);
  }
}