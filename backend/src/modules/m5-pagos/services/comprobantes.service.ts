import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import { ZONA_SEDE } from '../../../commons/fechas';
import { UsuariosService } from '../../m1-usuarios/services/usuarios.service';
import { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import { ReservaClasePrecioService } from '../../m3-clases/services/reserva-clase-precio.service';
import { ReservaPrecioService } from '../../m4-canchas/services/reserva-precio.service';
import { ConceptoPago, Pago } from '../entities/pago.entity';
import {
  COLOR_CABECERA,
  MARGEN,
  dibujarBadge,
  dibujarFila,
  dibujarMonto,
  dibujarPie,
  dibujarTitulo,
  etiquetaDelPlan,
  separarSecciones,
} from './comprobantes.estilo';

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
 *
 * QUÉ se imprime vive acá; CÓMO se ve (colores, medidas, filas, badge, recuadro del monto)
 * vive en `comprobantes.estilo.ts`.
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
    // RF-07: la penalidad por cancelacion tardia de una clase la resuelve M3.
    private readonly reservaClases: ReservaClasePrecioService,
    // RF-14: el comprobante imprime nombre y email del socio en el momento del cobro,
    // para que el PDF sea un snapshot con identidad (RF-02): aunque después se borre
    // el socio, el papel sigue diciendo quién pagó.
    private readonly usuarios: UsuariosService,
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

  /**
   * El PDF en memoria, sin escribirlo a disco. Es lo mismo que `generar()` usa por dentro;
   * queda accesible para quien necesite ver el resultado sin tocar `storage/` (las muestras
   * para revisar el diseño).
   */
  armarPdf(pago: Pago, concepto: ConceptoPago): Promise<Buffer> {
    // pdfkit es un stream: se le escriben trozos y se escucha `end`. Por eso el Buffer
    // se acumula a mano en vez de usar `doc.pipe()`, que escribiría directo a un archivo y
    // no dejaría revisar el resultado antes de tocar disco.
    return new Promise<Buffer>((resolve, reject) => {
      // Sin compresión: el archivo pesa un poco más y a cambio el texto del comprobante se
      // puede leer y verificar (los tests comprueban que el monto impreso sea el congelado, y
      // con streams comprimidos no se puede assertar nada del contenido). Para un ticket de
      // una hoja, el tamaño no es un problema; la ofuscación del PDF no aporta nada acá.
      const doc = new PDFDocument({ size: 'A4', margin: MARGEN, compress: false });
      const trozos: Buffer[] = [];
      doc.on('data', (trozo: Buffer) => trozos.push(trozo));
      doc.on('end', () => resolve(Buffer.concat(trozos)));
      doc.on('error', reject);

      this.cabeza(doc, pago)
        .then(() => this.detalle(doc, concepto))
        .then(() => {
          // El importe SIEMPRE sale de `pago.monto` (congelado al cobrar), nunca de una
          // recotización (decisión 4).
          dibujarMonto(doc, this.pesos(pago.monto, pago.moneda));
          dibujarPie(doc, 'Documento generado al momento del cobro.');
        })
        .then(() => doc.end())
        .catch(reject);
    });
  }

  private async cabeza(doc: PDFKit.PDFDocument, pago: Pago): Promise<void> {
    // Banda de marca: el bloque de color cruza toda la hoja y lleva el nombre y el
    // subtítulo en blanco, con el estado como badge en la esquina derecha.
    doc.rect(0, 0, doc.page.width, 78).fill(COLOR_CABECERA);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('FitZone Sports', MARGEN, 20);
    doc.font('Helvetica').fontSize(11).text('Comprobante de pago', MARGEN, 48);
    dibujarBadge(doc, pago.estado);

    doc.y = 96;
    dibujarTitulo(doc, 'Datos del pago');
    dibujarFila(doc, 'Pago', `#${pago.id}`);
    dibujarFila(doc, 'Fecha', this.fechaLegible(pago.fechaPago));
    dibujarFila(doc, 'Usuario', `#${pago.usuarioId}`);

    // Nombre y email del socio, resueltos al momento del cobro. Son el snapshot de
    // identidad del comprobante: si la fila del usuario no está (no debería, el
    // usuario no se borra aunque el socio sí), el PDF imprime "no disponible" en
    // vez de cortarse.
    const usuario = await this.usuarios.buscarDatosParaComprobante(pago.usuarioId);
    dibujarFila(doc, 'Nombre', usuario ? usuario.nombre : '(no disponible)');
    dibujarFila(doc, 'Email', usuario ? usuario.email : '(no disponible)');
  }

  /**
   * RF-14 pide "cancha, horario y monto". El monto va al cierre del documento; acá va el
   * detalle de qué se cobró, que es lo que hace que el comprobante sea comprobante y no un
   * recibo.
   */
  private async detalle(doc: PDFKit.PDFDocument, concepto: ConceptoPago): Promise<void> {
    separarSecciones(doc);
    dibujarTitulo(doc, 'Detalle');

    if (concepto.tipo === 'RESERVA_CANCHA') {
      const reserva = await this.reservas.obtenerParaCobro(concepto.reservaCanchaId);
      if (!reserva) {
        // No debería pasar: el cobro ya validó que la reserva existe y las reservas no se
        // borran. Si igual pasa, sale un PDF sin detalle en vez de cortarse a mitad de
        // escritura, que dejaría un archivo corrupto y un comprobante inútil.
        dibujarFila(doc, 'Reserva', `${concepto.reservaCanchaId} (no disponible).`);
        return;
      }

      dibujarFila(doc, 'Concepto', 'Reserva de cancha');
      dibujarFila(doc, 'Cancha', `N° ${reserva.canchaId}`);
      dibujarFila(
        doc,
        'Horario',
        `${this.fechaLegible(reserva.fechaHoraInicio)} - ${this.fechaLegible(reserva.fechaHoraFin)}`,
      );
      dibujarFila(doc, 'Reserva', `#${reserva.reservaId}`);
      return;
    }

    if (concepto.tipo === 'RESERVA_CLASE') {
      const clase = await this.reservaClases.obtenerParaCobro(concepto.reservaClaseId);
      if (!clase) {
        dibujarFila(doc, 'Reserva de clase', `${concepto.reservaClaseId} (no disponible).`);
        return;
      }

      dibujarFila(doc, 'Concepto', 'Reserva de clase');
      dibujarFila(doc, 'Clase', `N° ${clase.claseId}`);
      dibujarFila(doc, 'Horario', this.fechaLegible(clase.horarioInicio));
      dibujarFila(doc, 'Reserva', `#${clase.reservaClaseId}`);
      // El código del requisito (RF-07) queda en los comentarios: no se imprime en el papel del cliente.
      dibujarFila(doc, 'Nota', 'Penalidad por cancelación tardía.');
      return;
    }

    const membresia = await this.membresias.obtenerParaCobro(concepto.membresiaId);
    if (!membresia) {
      dibujarFila(doc, 'Membresía', `${concepto.membresiaId} (no disponible).`);
      return;
    }

    dibujarFila(doc, 'Concepto', 'Membresía');
    dibujarFila(doc, 'Plan', etiquetaDelPlan(membresia.plan));
    dibujarFila(doc, 'Membresía', `#${membresia.membresiaId}`);
  }

  // Fecha entendible en el comprobante: YYYY-MM-DD HH:MM, en hora local de la sede
  // (America/Argentina/Buenos_Aires) y sin sufijo de zona. Es el mismo criterio que
  // el resto del proyecto (commons/fechas.ts): la hora que ve el socio tiene que ser
  // la de la sede, no la UTC que daba `toISOString()` (Argentina está en UTC-3 y un
  // "22:00" local parecería "01:00" del día siguiente en UTC).
  private fechaLegible(momento: Date | string): string {
    const fecha = typeof momento === 'string' ? new Date(momento) : momento;
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_SEDE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(fecha);
    const parte = (tipo: Intl.DateTimeFormatPartTypes): string =>
      partes.find((p) => p.type === tipo)?.value ?? '';
    return `${parte('year')}-${parte('month')}-${parte('day')} ${parte('hour')}:${parte('minute')}`;
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
