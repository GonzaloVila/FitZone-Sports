import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Cancha } from '../entities/cancha.entity';

const TIPOS: Cancha['tipo'][] = ['PADDLE', 'FUTBOL5'];
const ESTADOS: Cancha['estado'][] = ['OPERATIVA', 'EN_MANTENIMIENTO'];

@Exclude()
export class CanchaOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 6 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 3 })
  sedeId!: number;

  @Expose()
  @ApiProperty({ enum: TIPOS, example: 'PADDLE' })
  tipo!: Cancha['tipo'];

  @Expose()
  @ApiProperty({ example: 5000 })
  costoPorHora!: number;

  @Expose()
  @ApiProperty({ enum: ESTADOS, example: 'OPERATIVA' })
  estado!: Cancha['estado'];
}
