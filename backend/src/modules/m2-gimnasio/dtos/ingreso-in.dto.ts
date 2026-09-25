import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class IngresoInDto {
  @ApiProperty({ description: 'Sede de ingreso (RF-05). La define el puesto de control.', example: 3 })
  @IsInt()
  @Min(1)
  sede_id!: number;

  @ApiProperty({ description: 'Usuario que ingresa; debe tener membresía vigente (RF-04).', example: 2 })
  @IsInt()
  @Min(1)
  usuario_id!: number;

  @ApiProperty({
    description:
      'Token del QR leído por el puesto de control. Campo opaco hoy: el mecanismo de QR ' +
      'dinámico (Unidad III) queda pendiente de definir con la cátedra; por ahora solo se exige que venga presente.',
    example: 'qr-7f3a-9c2e',
  })
  @IsString()
  @MinLength(1)
  qr_token!: string;

  @ApiPropertyOptional({
    description:
      'Momento real del acceso. Opcional para el puesto de control offline (RNF-01): al ' +
      'sincronizar, reporta la hora en que ocurrió el ingreso. Si se omite, se usa la hora del servidor.',
    example: '2026-09-16T18:02:11-03:00',
  })
  @IsOptional()
  @IsDateString()
  fecha_hora_ingreso?: string;

  @ApiPropertyOptional({
    description:
      'true si el puesto de control validó el QR sin conexión y sincroniza este ingreso después (RNF-01).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  validado_offline?: boolean;
}
