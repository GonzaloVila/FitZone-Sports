import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemDetailsDto {
  @ApiProperty({ format: 'uri', example: 'about:blank' })
  type!: string;

  @ApiProperty({ example: 'Recurso no encontrado' })
  title!: string;

  @ApiProperty({ example: 404 })
  status!: number;

  @ApiProperty({ example: 'No existe el recurso solicitado para el id indicado.' })
  detail!: string;

  @ApiPropertyOptional({ format: 'uri', example: '/api/v1/usuarios/1' })
  instance?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['nombre must be a string'],
    description: 'Solo en errores de validación (422): lista de reglas incumplidas.',
  })
  errors?: string[];
}