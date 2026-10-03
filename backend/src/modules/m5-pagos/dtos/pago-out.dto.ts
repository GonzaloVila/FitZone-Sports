import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { ConceptoMembresia, ConceptoReservaCancha } from './pago-in.dto';
import { Pago } from '../entities/pago.entity';

const ESTADOS: Pago['estado'][] = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO'];

/**
 * Lista blanca como `MembresiaOut` y `ReservaCanchaOut`: `@Exclude()` de clase con
 * `@Expose()` por campo. Acá importa por RNF-02 — `Pago` en el dominio tiene `token`
 * e `idempotencia_key`, y este DTO no expone ninguno de los dos.
 *
 * `token` además está declarado `writeOnly` en el contrato: es un dato que el
 * cliente manda y nunca debe volver. La garantía es doble y las dos mitades son
 * necesarias: `writeOnly` en el documento, y la ausencia del campo acá porque un
 * DTO de respuesta no filtra lo que no expone, se filtra lo que expone.
 */
@Exclude()
@ApiExtraModels(ConceptoReservaCancha, ConceptoMembresia)
export class PagoOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 8 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  usuario_id!: number;

  @Expose()
  @ApiProperty({
    description: 'Concepto cobrado: el `tipo` decide cuál id viene poblado.',
    oneOf: [
      { $ref: getSchemaPath(ConceptoReservaCancha) },
      { $ref: getSchemaPath(ConceptoMembresia) },
    ],
  })
  concepto!: Pago['concepto'];

  @Expose()
  @ApiProperty({
    type: 'number',
    description: 'Importe computado por la regla de negocio.',
    example: 4250,
  })
  monto!: number;

  @Expose()
  @ApiProperty({ type: 'string', example: 'ARS' })
  moneda!: string;

  @Expose()
  @ApiProperty({ enum: ESTADOS, example: 'APROBADO' })
  estado!: Pago['estado'];

  @Expose()
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description:
      'Momento del cobro. Es lo que permite ordenar el listado, filtrar por período ' +
      '(?desde=/?hasta=) y conciliar contra el reporte de la pasarela.',
    example: '2026-09-16T18:42:11.204Z',
  })
  fecha_pago!: Date;

  @Expose()
  @ApiProperty({
    type: 'string',
    nullable: true,
    description:
      'Adjunto del snapshot de la RF-14, solo cuando el pago está aprobado.',
  })
  comprobante_pdf_url!: string | null;
}