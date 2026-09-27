import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReservaClaseOutDto {
  @ApiProperty({ example: 10 })
  @Expose()
  id!: number;

  @ApiProperty({ example: 1 })
  @Expose()
  clase_id!: number;

  @ApiProperty({ example: 1 })
  @Expose()
  socio_id!: number;

  @ApiProperty({ example: 'CONFIRMADA', enum: ['CONFIRMADA', 'CANCELADA'] })
  @Expose()
  estado!: string;
}
