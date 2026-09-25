import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CrearSedeDto {
  @ApiProperty({ example: 'FitZone Norte' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({ example: 'Av. Colón 1200, Córdoba' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  direccion!: string;

  @ApiProperty({
    description: 'Capacidad simultánea de la sede (se valida contra los Ingresos abiertos, RF-05).',
    example: 120,
  })
  @IsInt()
  @Min(1)
  aforo_maximo!: number;
}
