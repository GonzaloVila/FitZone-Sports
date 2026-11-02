import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../commons/guards/jwt-auth.guard';
import { Roles } from '../../../commons/guards/roles.decorator';
import { RolesGuard } from '../../../commons/guards/roles.guard';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { UsuarioIn } from '../dtos/usuario-in.dto';
import { ListarUsuariosQueryDto } from '../dtos/listar-usuarios-query.dto';
import { UsuarioPatch } from '../dtos/usuario-patch.dto';
import { UsuarioOut } from '../dtos/usuario-out.dto';
import { ListaUsuariosDto } from '../dtos/lista-usuarios.dto';
import { UsuariosAccesoService } from '../services/usuarios-acceso.service';
import { UsuariosService } from '../services/usuarios.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

const NO_AUTORIZADO = 'Token inválido, expirado o ausente';

// Todo el controller exige sesion. Crear, listar y modificar son de RECEPCION y GERENTE (@Roles); leer un usuario es de
// cualquier rol, pero SOCIO y EXTERNO solo el propio. Lo que depende de a quien se refiere el pedido (RECEPCION crea solo
// EXTERNO y modifica solo a SOCIO y EXTERNO, el dueño) lo decide UsuariosAccesoService.
@ApiTags('usuarios')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly acceso: UsuariosAccesoService,
  ) {}

  @Post()
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'crearUsuario', summary: 'Registrar usuario' })
  @ApiCreatedResponse({
    description: 'Usuario creado',
    type: UsuarioOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/usuarios/1' } },
    },
  })
  @ApiBadRequestResponse({ description: 'Solicitud mal formada (JSON inválido)', content: PROBLEM_JSON })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({
    description: 'Rol sin permiso (solo RECEPCION/GERENTE) o RECEPCION creando un rol que no sea EXTERNO',
    content: PROBLEM_JSON,
  })
  @ApiNotFoundResponse({
    description: 'La sede de trabajo indicada no existe (solo RECEPCION)',
    content: PROBLEM_JSON,
  })
  @ApiConflictResponse({
    description: 'El email o el DNI ya están registrados, o la sede ya tiene un recepcionista',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  async crear(
    @Body() dto: UsuarioIn,
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UsuarioOut> {
    const usuario = await this.acceso.crear(req.user, dto);
    res.setHeader('Location', `/api/v1/usuarios/${usuario.id}`);
    return usuario;
  }

  // Declarado antes que @Get(':id'): ademas de ser el orden logico de lectura,
  // deja explicito que /usuarios no cae en la ruta con parametro.
  @Get()
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'listarUsuarios', summary: 'Listado de usuarios con filtros' })
  @ApiOkResponse({ description: 'Listado de usuarios', type: ListaUsuariosDto })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: 'Rol sin permiso (solo RECEPCION/GERENTE)', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() dto: ListarUsuariosQueryDto): Promise<ListaUsuariosDto> {
    return this.usuariosService.listar(dto);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'obtenerUsuario', summary: 'Obtener usuario por id' })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID numérico del usuario', example: 1 })
  @ApiOkResponse({ description: 'Usuario encontrado', type: UsuarioOut })
  @ApiBadRequestResponse({ description: 'id no numérico', content: PROBLEM_JSON })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Usuario inexistente (o ajeno, para SOCIO y EXTERNO)', content: PROBLEM_JSON })
  obtener(@Param('id', ParseIntPipe) id: number, @Req() req: RequestConUsuario): Promise<UsuarioOut> {
    return this.acceso.obtener(req.user, id);
  }

  @Patch(':id')
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'modificarUsuario', summary: 'Modificar parcialmente un usuario' })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID numérico del usuario', example: 1 })
  @ApiOkResponse({ description: 'Usuario actualizado', type: UsuarioOut })
  @ApiBadRequestResponse({ description: 'id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({
    description: 'Rol sin permiso (solo RECEPCION/GERENTE) o RECEPCION sobre un RECEPCION o GERENTE',
    content: PROBLEM_JSON,
  })
  @ApiNotFoundResponse({ description: 'Usuario inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UsuarioPatch,
    @Req() req: RequestConUsuario,
  ): Promise<UsuarioOut> {
    return this.acceso.modificar(req.user, id, dto);
  }
}