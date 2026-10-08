import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RegistroQrOut {
  @Expose()
  @ApiProperty({
    example: 'otpauth://totp/FitZone:socio@email.com?secret=JBSWY3DPEHPK3PXP&issuer=FitZone',
    description: 'URI del QR a escanear con una app TOTP (Google Authenticator, Authy, etc.).',
  })
  qrUri!: string;

  @Expose()
  @ApiProperty({ example: 'Escaneá el QR con tu app de autenticación' })
  mensaje!: string;
}
