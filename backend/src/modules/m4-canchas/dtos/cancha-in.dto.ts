import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { Cancha } from '../entities/cancha.entity';

const TIPOS: Cancha['tipo'][] = ['PADDLE', 'FUTBOL5'];
const ESTADOS: Cancha['estado'][] = ['OPERATIVA', 'EN_MANTENIMIENTO'];

export class CanchaIn {
  @ApiProperty({ enum: TIPOS, description: 'Tipo de cancha.' })
  @IsIn(TIPOS)
  tipo!: Cancha['tipo'];

  @ApiProperty({ minimum: 0, description: 'Configurable por el Gerente (RF-09).', example: 5000 })
  @IsNumber()
  @Min(0)
  costo_por_hora!: number;

  @ApiPropertyOptional({ enum: ESTADOS, default: 'OPERATIVA' })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Cancha['estado'];
}
