import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshIn {
  @ApiPropertyOptional({
    example: 'k3J9x0Qm1c8e...',
    description:
      'Refresh token. Lo manda el cliente movil, que lo recibio en el body del login. ' +
      'Si se omite, se lee de la cookie refresh_token; si vienen los dos, manda el body.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
