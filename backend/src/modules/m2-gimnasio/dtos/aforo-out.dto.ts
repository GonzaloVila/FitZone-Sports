import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AforoOutDto {
  @Expose()
  @ApiProperty({ description: 'Ingresos sin egreso en la sede, en este momento (RN-01/RF-05).', example: 78 })
  aforo_actual!: number;

  @Expose()
  @ApiProperty({ description: 'Valor configurado en Sede.aforo_maximo.', example: 120 })
  aforo_maximo!: number;

  @Expose()
  @ApiProperty({ description: 'aforo_maximo - aforo_actual. Cero o negativo implica acceso 409.', example: 42 })
  restante!: number;
}
