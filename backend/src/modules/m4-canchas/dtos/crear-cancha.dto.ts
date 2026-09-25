import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { Cancha } from '../entities/cancha.entity';

const TIPOS: Cancha['tipo'][] = ['PADDLE', 'FUTBOL5'];
const ESTADOS: Cancha['estado'][] = ['OPERATIVA', 'EN_MANTENIMIENTO'];

export class CrearCanchaDto {
  @ApiProperty({ enum: TIPOS, example: 'PADDLE' })
  @IsIn(TIPOS)
  tipo!: Cancha['tipo'];

  @ApiProperty({ description: 'Costo por hora de la cancha.', example: 5000 })
  @IsNumber()
  @Min(0)
  costo_por_hora!: number;

  @ApiPropertyOptional({ enum: ESTADOS, default: 'OPERATIVA', example: 'OPERATIVA' })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Cancha['estado'];
}
