import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class ReservaClaseIn {
  @ApiProperty({
    type: 'integer',
    description: 'Clase de la que se reserva el cupo (RF-06)',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  claseId!: number;

  @ApiProperty({
    type: 'integer',
    description: 'ID del socio que solicita la reserva',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  socioId!: number;
}
