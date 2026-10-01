import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';
import { Reserva } from '../entities/reserva.entity';

const ESTADOS: Reserva['estado'][] = ['CONFIRMADA', 'CANCELADA'];

export class ListarReservasCanchasQueryDto {
  @ApiPropertyOptional({ type: 'integer', description: 'ID numérico de la cancha', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cancha_id?: number;

  @ApiPropertyOptional({ type: 'integer', description: 'ID numérico del usuario', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuario_id?: number;

  @ApiPropertyOptional({
    enum: ESTADOS,
    default: 'CONFIRMADA',
    description: 'Si se omite, solo se listan las CONFIRMADA; las canceladas se piden con estado=CANCELADA.',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Reserva['estado'];

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: 'Día de inicio del turno (YYYY-MM-DD, hora local de la sede).',
    example: '2026-10-05',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD.' })
  @IsISO8601({ strict: true }, { message: 'fecha debe ser un día válido.' })
  fecha?: string;

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
