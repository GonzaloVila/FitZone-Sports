import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Pago } from '../entities/pago.entity';

/**
 * Lista blanca como `MembresiaOut` y `ReservaCanchaOut`: `@Exclude()` de clase con
 * `@Expose()` por campo. Acá importa por RNF-02 — `Pago` en el dominio tiene `token`
 * e `idempotencia_key`, y este DTO no expone ninguno de los dos.
 *
 * `token` además está declarado `writeOnly` en el contrato: es un dato que el
 * cliente manda y nunca debe volver. La garantía es doble y las dos mitades son
 * necesarias: `writeOnly` en el documento, y la ausencia del campo acá porque un
 * DTO de respuesta no filtra lo que no expone, se filtra lo que expone.
 *
 * `concepto` y `estado` se declaran acá solo para que entren en el documento; lo que
 * se publica son los `$ref` a `ConceptoPago` y `EstadoPago`, y eso lo reemplaza
 * `marcarSchemasDePagos()`.
 */
@Exclude()
@ApiExtraModels()
export class PagoOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 8 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  usuario_id!: number;

  @Expose()
  @ApiProperty()
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
  @ApiProperty()
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
  // Opcional de verdad: el contrato lo saca del `required` de `PagoOut` porque el
  // comprobante solo existe cuando el pago está aprobado (RF-14). Con
  // `@ApiProperty` aparecía como required: el plugin del CLI de Swagger no está
  // activo, así que Nest infiere required de todo lo que no sea opcional.
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description:
      'Adjunto del snapshot de la RF-14, solo cuando el pago está aprobado.',
  })
  comprobante_pdf_url!: string | null;
}