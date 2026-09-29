import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class ListarIngresosQueryDto {
  @ApiPropertyOptional({ type: 'integer', description: 'ID numérico de la sede', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sede_id?: number;

  @ApiPropertyOptional({ type: 'integer', description: 'ID numérico del usuario', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuario_id?: number;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: 'Día consultado (YYYY-MM-DD, hora local de la sede).',
    example: '2026-09-16',
  })
  @IsOptional()
  // @IsDateString() aceptaría también un date-time completo, pero el contrato
  // pide un día, no un instante. El patrón lo deja explícito.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD.' })
  fecha?: string;

  @ApiPropertyOptional({
    type: 'boolean',
    description: 'true trae solo los ingresos con fecha_hora_egreso nula (aún en la sede).',
    example: true,
  })
  @IsOptional()
  // El query string llega como texto y Boolean("false") es true, así que un
  // @Type(() => Boolean) invertiría el filtro en silencio. Solo se mapean los
  // dos valores válidos y cualquier otra cosa se deja sin tocar para que la
  // validación la rechace con 422 en vez de convertirla en false.
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  dentro?: boolean;

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
