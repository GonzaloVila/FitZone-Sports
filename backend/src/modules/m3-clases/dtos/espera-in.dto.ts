import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class EsperaIn {
  @ApiProperty({
    type: 'integer',
    description: 'ID del socio que se anota en lista de espera',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  socioId!: number;
}
