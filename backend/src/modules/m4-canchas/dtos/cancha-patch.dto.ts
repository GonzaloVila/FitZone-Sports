import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { Cancha } from '../entities/cancha.entity';

const ESTADOS: Cancha['estado'][] = ['OPERATIVA', 'EN_MANTENIMIENTO'];

export class CanchaPatch {
  @ApiPropertyOptional({
    minimum: 0,
    description: 'Nuevo costo por hora de la cancha.',
    example: 5500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costo_por_hora?: number;

  @ApiPropertyOptional({ enum: ESTADOS })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Cancha['estado'];
}
