import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { Roles } from '../../commons/guards/roles.decorator';
import { RolesGuard } from '../../commons/guards/roles.guard';
import { Problem } from '../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../commons/swagger/problem-json';
import { AuthService } from './auth.service';
import { LoginIn } from './dtos/login-in.dto';
import { LoginOut } from './dtos/login-out.dto';
import { RegistroQrOut } from './dtos/registro-qr-out.dto';
import { TotpService } from './services/totp.service';
import type { UsuarioAutenticado } from './strategies/jwt.strategy';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

@ApiTags('auth')
@ApiExtraModels(Problem)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'login', summary: 'Login con email y contraseña' })
  @ApiOkResponse({ description: 'Login exitoso', type: LoginOut })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas', content: PROBLEM_JSON })
  login(@Body() dto: LoginIn): Promise<LoginOut> {
    return this.authService.login(dto);
  }

  @Post('registro-qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SOCIO')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'registrarQr',
    summary: 'Genera secreto TOTP y QR URI para el socio autenticado',
  })
  @ApiCreatedResponse({ description: 'QR generado', type: RegistroQrOut })
  @ApiUnauthorizedResponse({ description: 'Token inválido, expirado o ausente', content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: 'El usuario autenticado no es socio', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'El usuario autenticado no tiene registro de socio', content: PROBLEM_JSON })
  registrarQr(@Req() req: RequestConUsuario): Promise<RegistroQrOut> {
    return this.totpService.generarRegistro(req.user.userId);
  }
}
