import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class ClaseIn {
  @ApiProperty({
    type: 'integer',
    description: 'ID de la sede donde se dicta la clase',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  sedeId!: number;

  @ApiProperty({ description: 'Tipo o disciplina de la clase', example: 'Spinning' })
  @IsString()
  @IsNotEmpty()
  tipo!: string;

  @ApiProperty({ description: 'Nombre del instructor', example: 'Martín Palermo' })
  @IsString()
  @IsNotEmpty()
  instructor!: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Fecha y hora de inicio de la clase (formato ISO-8601 UTC)',
    example: '2026-10-15T18:00:00Z',
  })
  @IsISO8601()
  horario!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Capacidad máxima de asistentes',
    example: 20,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  capacidad!: number;
}
