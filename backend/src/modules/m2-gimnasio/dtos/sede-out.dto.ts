import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SedeOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 3 })
  id!: number;

  @Expose()
  @ApiProperty({ example: 'FitZone Norte' })
  nombre!: string;

  @Expose()
  @ApiProperty({ example: 'Av. Colón 1200, Córdoba' })
  direccion!: string;

  @Expose()
  @ApiProperty({ type: 'integer', example: 120 })
  aforoMaximo!: number;
}
