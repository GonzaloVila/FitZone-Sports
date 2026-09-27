import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CrearClaseDto {
  @ApiProperty({ description: 'ID de la sede donde se dicta la clase', example: 1 })
  @IsInt()
  @IsPositive()
  sede_id!: number;

  @ApiProperty({ description: 'Tipo o disciplina de la clase', example: 'Spinning' })
  @IsString()
  @IsNotEmpty()
  tipo!: string;

  @ApiProperty({ description: 'Nombre del instructor', example: 'Martín Palermo' })
  @IsString()
  @IsNotEmpty()
  instructor!: string;

  @ApiProperty({
    description: 'Fecha y hora de inicio de la clase (formato ISO-8601 UTC)',
    example: '2026-10-15T18:00:00Z',
  })
  @IsISO8601()
  horario!: string;

  @ApiProperty({ description: 'Capacidad máxima de asistentes', example: 20, minimum: 1 })
  @IsInt()
  @IsPositive()
  capacidad!: number;
}
