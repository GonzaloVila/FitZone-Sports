import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import type { Request, Response } from 'express';
import { leerCookie } from '../../commons/cookies';
import { ProblemException } from '../../commons/filters/problem.exception';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { Roles } from '../../commons/guards/roles.decorator';
import { RolesGuard } from '../../commons/guards/roles.guard';
import { Problem } from '../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../commons/swagger/problem-json';
import { AuthService } from './auth.service';
import type { SesionEmitida } from './auth.service';
import { LoginIn } from './dtos/login-in.dto';
import { LoginOut } from './dtos/login-out.dto';
import { RefreshIn } from './dtos/refresh-in.dto';
import { RegistroQrOut } from './dtos/registro-qr-out.dto';
import { origenNoPermitido, sesionInvalida } from './errors/auth.errors';
import {
  esClienteMovil,
  opcionesBorrarCookieRefresh,
  opcionesCookieRefresh,
  origenPermitido,
  REFRESH_COOKIE,
} from './refresh-cookie';
import type { AjustesCookie } from './refresh-cookie';
import { TotpService } from './services/totp.service';
import type { UsuarioAutenticado } from './strategies/jwt.strategy';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

// Canal por el que llego el refresh token: el body (cliente movil) o la cookie
// (web). La respuesta de refresh vuelve por el mismo canal.
type CanalRefresh = 'body' | 'cookie';

const SET_COOKIE_HEADER = {
  'Set-Cookie': {
    description:
      'Cookie refresh_token (HttpOnly, Path=/api/v1/auth, SameSite y Secure segun la configuracion). ' +
      'No se envia si el request trae X-Cliente: movil.',
    schema: { type: 'string' },
  },
};

@ApiTags('auth')
@ApiExtraModels(Problem)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'login', summary: 'Login con email y contraseña' })
  @ApiHeader({
    name: 'X-Cliente',
    required: false,
    description:
      'Con el valor "movil" el refresh token viaja en el body (campo refreshToken) y no se setea cookie. ' +
      'Sin este header el refresh token va solo en la cookie HttpOnly refresh_token.',
    schema: { type: 'string', enum: ['movil'] },
  })
  @ApiOkResponse({ description: 'Login exitoso', type: LoginOut, headers: SET_COOKIE_HEADER })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas', content: PROBLEM_JSON })
  async login(
    @Body() dto: LoginIn,
    @Headers('X-Cliente') cliente: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginOut> {
    const sesion = await this.authService.login(dto);

    if (esClienteMovil(cliente)) {
      return this.conRefreshEnBody(sesion);
    }
    this.setearCookie(res, sesion.refreshToken);
    return sesion.respuesta;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'refrescarToken',
    summary: 'Renueva el access token y rota el refresh token',
    description:
      'Público: se autentica por el refresh token, que llega por body (RefreshIn, cliente movil) o por la ' +
      'cookie refresh_token; si vienen los dos, manda el body. La respuesta vuelve por el mismo canal. ' +
      'Con la cookie se exige el header Origin y que esté permitido (CSRF). Cada refresh token sirve una ' +
      'sola vez: presentar uno ya usado cierra todas las sesiones del usuario.',
  })
  @ApiOkResponse({ description: 'Sesión renovada', type: LoginOut, headers: SET_COOKIE_HEADER })
  @ApiUnauthorizedResponse({
    description: 'Refresh token ausente, inexistente, vencido, revocado o reusado',
    content: PROBLEM_JSON,
  })
  @ApiForbiddenResponse({
    description: 'El token llegó por cookie y el header Origin falta o no está permitido',
    content: PROBLEM_JSON,
  })
  async refrescar(
    @Body() dto: RefreshIn,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginOut> {
    const resuelto = this.resolverToken(dto, req);
    // Sin token en ninguno de los dos canales no hay cookie que proteger: 401.
    if (resuelto === null) {
      throw sesionInvalida();
    }
    const { token, canal } = resuelto;
    if (canal === 'cookie') {
      this.exigirOrigenPermitido(req);
    }

    let sesion: SesionEmitida;
    try {
      sesion = await this.authService.refrescar(token);
    } catch (error) {
      // Solo el 401 de sesion invalida deja la cookie inservible y se borra. Ante
      // cualquier otro error (p. ej. un 5xx por la base) el refresh token puede
      // seguir siendo valido: la cookie queda como esta y el error se relanza.
      if (canal === 'cookie' && esSesionInvalida(error)) {
        this.borrarCookie(res);
      }
      throw error;
    }

    if (canal === 'body') {
      return this.conRefreshEnBody(sesion);
    }
    this.setearCookie(res, sesion.refreshToken);
    return sesion.respuesta;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'cerrarSesion',
    summary: 'Cierra la sesión del dispositivo (revoca la familia del refresh token)',
    description:
      'Público y sin bearer: se autentica por el refresh token (body o cookie, igual que refresh). ' +
      'Idempotente: un token desconocido o ya revocado también responde 204. Con la cookie se exige ' +
      'el header Origin permitido y la respuesta borra la cookie.',
  })
  @ApiNoContentResponse({ description: 'Sesión cerrada', headers: SET_COOKIE_HEADER })
  @ApiForbiddenResponse({
    description: 'El token llegó por cookie y el header Origin falta o no está permitido',
    content: PROBLEM_JSON,
  })
  async cerrarSesion(
    @Body() dto: RefreshIn,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const resuelto = this.resolverToken(dto, req);
    // Idempotente: sin token no hay nada que cerrar ni cookie que borrar.
    if (resuelto === null) {
      return;
    }
    const { token, canal } = resuelto;
    if (canal === 'cookie') {
      this.exigirOrigenPermitido(req);
    }
    await this.authService.cerrarSesion(token);
    if (canal === 'cookie') {
      this.borrarCookie(res);
    }
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

  // Si vienen el body y la cookie, manda el body. null = no vino ninguno.
  private resolverToken(dto: RefreshIn, req: Request): { token: string; canal: CanalRefresh } | null {
    if (dto.refreshToken !== undefined) {
      return { token: dto.refreshToken, canal: 'body' };
    }
    const desdeCookie = leerCookie(req.headers.cookie, REFRESH_COOKIE);
    return desdeCookie === undefined ? null : { token: desdeCookie, canal: 'cookie' };
  }

  // Con el token en cookie el navegador lo adjunta solo, asi que se exige que el
  // request declare un Origin permitido. Se suma a SameSite, no lo reemplaza.
  private exigirOrigenPermitido(req: Request): void {
    const permitidos = this.configService.get<string[]>('CORS_ORIGINS')!;
    if (!origenPermitido(req.headers.origin, permitidos)) {
      throw origenNoPermitido();
    }
  }

  private conRefreshEnBody(sesion: SesionEmitida): LoginOut {
    return plainToInstance(LoginOut, { ...sesion.respuesta, refreshToken: sesion.refreshToken });
  }

  private ajustesCookie(): AjustesCookie {
    return {
      maxAgeSegundos: this.configService.get<number>('REFRESH_EXPIRES_IN')!,
      sameSite: this.configService.get<'strict' | 'lax' | 'none'>('REFRESH_COOKIE_SAMESITE')!,
      secure: this.configService.get<boolean>('REFRESH_COOKIE_SECURE')!,
    };
  }

  private setearCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE, refreshToken, opcionesCookieRefresh(this.ajustesCookie()));
  }

  private borrarCookie(res: Response): void {
    res.cookie(REFRESH_COOKIE, '', opcionesBorrarCookieRefresh(this.ajustesCookie()));
  }
}

function esSesionInvalida(error: unknown): boolean {
  return error instanceof ProblemException && error.getStatus() === HttpStatus.UNAUTHORIZED;
}
