import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';

/**
 * Filtros de `GET /reportes/pagos`. Mismo par de decoradores que `ListarPagosQueryDto`:
 * el patrón fija "un día, no un instante" y `IsISO8601` descarta días inexistentes
 * (2026-02-30), que si no llegarían a `rangoDelDia()` y saldrían como 500.
 */
export class ListarReporteQueryDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: 'Inicio del período, inclusivo (YYYY-MM-DD, hora local de la sede).',
    example: '2026-10-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'desde debe tener formato YYYY-MM-DD.' })
  @IsISO8601({ strict: true }, { message: 'desde debe ser un día válido.' })
  desde?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: 'Fin del período, inclusivo (YYYY-MM-DD, hora local de la sede).',
    example: '2026-10-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hasta debe tener formato YYYY-MM-DD.' })
  @IsISO8601({ strict: true }, { message: 'hasta debe ser un día válido.' })
  hasta?: string;
}
