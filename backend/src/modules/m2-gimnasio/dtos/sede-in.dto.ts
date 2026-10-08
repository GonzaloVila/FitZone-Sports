import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class SedeIn {
  // Los límites van declarados en @ApiProperty y no solo en los decoradores de
  // class-validator: el documento OpenAPI los describe para el cliente, pero
  // ningún decorador de validación llega hasta el swagger.
  @ApiProperty({ minLength: 1, maxLength: 100, example: 'FitZone Norte' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({ minLength: 1, maxLength: 200, example: 'Av. Colón 1200, Córdoba' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  direccion!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: 'Capacidad simultánea de la sede (se valida contra los Ingresos abiertos, RF-05).',
    example: 120,
  })
  @IsInt()
  @Min(1)
  aforoMaximo!: number;
}
