import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class CrearReservaClaseDto {
  @ApiProperty({ description: 'ID del socio que solicita la reserva', example: 1 })
  @IsInt()
  @IsPositive()
  socio_id!: number;
}
