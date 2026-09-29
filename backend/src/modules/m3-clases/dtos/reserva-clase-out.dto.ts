import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReservaClaseOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 10 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  clase_id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  socio_id!: number;

  @Expose()
  @ApiProperty({ example: 'CONFIRMADA', enum: ['CONFIRMADA', 'CANCELADA'] })
  estado!: string;
}
