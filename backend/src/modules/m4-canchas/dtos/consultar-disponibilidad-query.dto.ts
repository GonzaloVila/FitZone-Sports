import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';

export class ConsultarDisponibilidadQueryDto {
  @ApiProperty({
    type: 'string',
    format: 'date',
    description: 'Día consultado (YYYY-MM-DD, hora local de la sede).',
    example: '2026-10-05',
  })
  // El patrón fija "un día, no un instante"; IsISO8601 strict descarta fechas
  // que el patrón acepta pero no existen (2026-02-30), que si no llegarían a
  // rangoDelDia() y saldrían como 500.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD.' })
  @IsISO8601({ strict: true }, { message: 'fecha debe ser un día válido.' })
  fecha!: string;

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
  perPage?: number = 20;
}
