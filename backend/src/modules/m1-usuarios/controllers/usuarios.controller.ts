import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { UsuarioIn } from '../dtos/usuario-in.dto';
import { ListarUsuariosQueryDto } from '../dtos/listar-usuarios-query.dto';
import { UsuarioPatch } from '../dtos/usuario-patch.dto';
import { UsuarioOut } from '../dtos/usuario-out.dto';
import { UsuariosService } from '../services/usuarios.service';

@ApiTags('usuarios')
@ApiExtraModels(Problem)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @ApiOperation({ operationId: 'crearUsuario', summary: 'Registrar usuario' })
  @ApiCreatedResponse({
    description: 'Usuario creado',
    type: UsuarioOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/usuarios/1' } },
    },
  })
  @ApiBadRequestResponse({ description: 'Solicitud mal formada (JSON inválido)', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'El email o el DNI ya están registrados (unicidad)',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  async crear(
    @Body() dto: UsuarioIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UsuarioOut> {
    const usuario = await this.usuariosService.crear(dto);
    res.setHeader('Location', `/api/v1/usuarios/${usuario.id}`);
    return usuario;
  }

  // Declarado antes que @Get(':id'): ademas de ser el orden logico de lectura,
  // deja explicito que /usuarios no cae en la ruta con parametro.
  @Get()
  @ApiOperation({ operationId: 'listarUsuarios', summary: 'Listado de usuarios con filtros' })
  @ApiOkResponse({ description: 'Listado de usuarios', type: [UsuarioOut] })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() dto: ListarUsuariosQueryDto): Promise<UsuarioOut[]> {
    return this.usuariosService.listar(dto);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'obtenerUsuario', summary: 'Obtener usuario por id' })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID numérico del usuario', example: 1 })
  @ApiOkResponse({ description: 'Usuario encontrado', type: UsuarioOut })
  @ApiBadRequestResponse({ description: 'id no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Usuario inexistente', content: PROBLEM_JSON })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UsuarioOut> {
    return this.usuariosService.obtenerPorId(id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'modificarUsuario', summary: 'Modificar parcialmente un usuario' })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID numérico del usuario', example: 1 })
  @ApiOkResponse({ description: 'Usuario actualizado', type: UsuarioOut })
  @ApiBadRequestResponse({ description: 'id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Usuario inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UsuarioPatch,
  ): Promise<UsuarioOut> {
    return this.usuariosService.modificar(id, dto);
  }
}