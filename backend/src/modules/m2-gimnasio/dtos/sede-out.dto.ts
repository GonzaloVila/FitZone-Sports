import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SedeOutDto {
  @Expose()
  @ApiProperty({ example: 3 })
  id!: number;

  @Expose()
  @ApiProperty({ example: 'FitZone Norte' })
  nombre!: string;

  @Expose()
  @ApiProperty({ example: 'Av. Colón 1200, Córdoba' })
  direccion!: string;

  @Expose()
  @ApiProperty({ example: 120 })
  aforo_maximo!: number;
}
