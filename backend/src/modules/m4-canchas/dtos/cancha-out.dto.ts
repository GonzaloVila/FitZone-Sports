import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Cancha } from '../entities/cancha.entity';

const TIPOS: Cancha['tipo'][] = ['PADDLE', 'FUTBOL5'];
const ESTADOS: Cancha['estado'][] = ['OPERATIVA', 'EN_MANTENIMIENTO'];

@Exclude()
export class CanchaOutDto {
  @Expose()
  @ApiProperty({ example: 1 })
  id!: number;

  @Expose()
  @ApiProperty({ example: 1 })
  sede_id!: number;

  @Expose()
  @ApiProperty({ enum: TIPOS, example: 'PADDLE' })
  tipo!: Cancha['tipo'];

  @Expose()
  @ApiProperty({ example: 5000 })
  costo_por_hora!: number;

  @Expose()
  @ApiProperty({ enum: ESTADOS, example: 'OPERATIVA' })
  estado!: Cancha['estado'];
}
