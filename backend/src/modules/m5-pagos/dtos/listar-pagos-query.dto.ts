import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';
import { ConceptoPago, Pago } from '../entities/pago.entity';

const ESTADOS: Pago['estado'][] = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO'];
const TIPOS: ConceptoPago['tipo'][] = ['RESERVA_CANCHA', 'MEMBRESIA'];

/**
 * La lista blanca de filtros de `GET /pagos`.
 *
 * `whitelist: true` + `forbidNonWhitelisted: true` en el `ValidationPipe` global hacen
 * que un parámetro que no esté declarado acá sea un 422 y no un filtro ignorado en
 * silencio: la alternativa (`additionalProperties: false` en el DTO) no existe en
 * class-validator, y un `?estado_typo=RECHAZADO` que devuelve la lista completa es
 * peor que un error.
 */
export class ListarPagosQueryDto {
  @ApiPropertyOptional({ type: 'integer', description: 'ID numérico del usuario que pagó', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuario_id?: number;

  // Sin `default` en el Swagger a propósito: el contrato declara el filtro como
  // `$ref: EstadoPago` sin default, y la regla "sin estado devuelve solo APROBADO"
  // vive en el service porque es negocio. Mismo criterio que el listado de reservas
  // de M4.
  @ApiPropertyOptional({
    enum: ESTADOS,
    description: 'Estado del pago. Sin este parámetro devuelve solo los APROBADO.',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Pago['estado'];

  // El discriminante del `oneOf` de `ConceptoPago`. Es un filtro REDUNDANTE con
  // `reserva_cancha_id`/`membresia_id` para fines de resultado (si se cruza con uno de
  // esos, el `tipo` ya se deduce), y el contrato lo pide igual porque es lo que
  // permite paginar sobre "pagos de reserva" sin conocer el id de la reserva.
  @ApiPropertyOptional({
    type: 'string',
    enum: TIPOS,
    description: 'Discriminante del concepto cobrado.',
    example: 'RESERVA_CANCHA',
  })
  @IsOptional()
  @IsIn(TIPOS)
  tipo?: ConceptoPago['tipo'];

  @ApiPropertyOptional({
    type: 'integer',
    description: 'Solo pagos cuyo concepto es una reserva de esta cancha (PagoReserva.reserva_id).',
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reserva_cancha_id?: number;

  @ApiPropertyOptional({
    type: 'integer',
    description:
      'Solo pagos cuyo concepto es esta membresía (PagoMembresia.membresia_id); una membresía admite varios pagos por renovación.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  membresia_id?: number;

  // El patrón fija "un día, no un instante" y el `IsISO8601` descarta los días que el
  // patrón acepta pero no existen (2026-02-30), que si no llegarían a `rangoDelDia()` y
  // saldrían como 500. Es el mismo par de decoradores del filtro `fecha` de M4.
  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: 'Inicio del intervalo, inclusivo (YYYY-MM-DD, hora local).',
    example: '2026-03-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'desde debe tener formato YYYY-MM-DD.' })
  @IsISO8601({ strict: true }, { message: 'desde debe ser un día válido.' })
  desde?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: 'Fin del intervalo, inclusivo (YYYY-MM-DD, hora local).',
    example: '2026-03-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hasta debe tener formato YYYY-MM-DD.' })
  @IsISO8601({ strict: true }, { message: 'hasta debe ser un día válido.' })
  hasta?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 20;
}