import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class IngresoIn {
  // type: 'integer' explícito porque Nest infiere `number` de un number de
  // TypeScript y el contrato declara integer. minimum no se declara: el
  // contrato no lo pide para estos dos campos, aunque @Min(1) los rechace.
  @ApiProperty({ type: 'integer', description: 'Sede de ingreso (RF-05). La define el puesto de control.', example: 3 })
  @IsInt()
  @Min(1)
  sede_id!: number;

  @ApiProperty({ type: 'integer', description: 'Socio que ingresa; debe tener membresía vigente (RF-04).', example: 2 })
  @IsInt()
  @Min(1)
  socio_id!: number;

  @ApiProperty({
    description: 'Código TOTP de 6 dígitos generado por la app del socio (RF-04, QR dinámico).',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'codigo_totp debe ser de 6 dígitos numéricos' })
  codigo_totp!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Momento real del acceso. Opcional para el puesto de control offline (RNF-01): al ' +
      'sincronizar, reporta la hora en que ocurrió el ingreso. Si se omite, se usa la hora del servidor.',
    example: '2026-09-16T18:02:11-03:00',
  })
  @IsOptional()
  @IsDateString()
  fecha_hora_ingreso?: string;

  // Sin default a propósito: el contrato no declara default para validado_offline
  // y documentarlo acá agregaría una diferencia de la nada. El default real lo
  // aplica el repository con `?? false` cuando el campo no viene.
  @ApiPropertyOptional({
    description:
      'true si el puesto de control validó el QR sin conexión y sincroniza este ingreso después (RNF-01).',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  validado_offline?: boolean;
}
