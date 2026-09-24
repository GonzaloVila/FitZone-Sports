import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { ProblemDetailsDto } from '../../../commons/swagger/problem-details.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { CrearUsuarioDto } from '../dtos/crear-usuario.dto';
import { ModificarUsuarioDto } from '../dtos/modificar-usuario.dto';
import { UsuarioOutDto } from '../dtos/usuario-out.dto';
import { UsuariosService } from '../services/usuarios.service';

@ApiTags('M1 Usuarios')
@ApiExtraModels(ProblemDetailsDto)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @ApiOperation({ operationId: 'crearUsuario', summary: 'Alta de usuario (perfil EXTERNO/RECEPCION/GERENTE)' })
  @ApiCreatedResponse({
    description: 'Usuario creado',
    type: UsuarioOutDto,
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
    @Body() dto: CrearUsuarioDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UsuarioOutDto> {
    const usuario = await this.usuariosService.crear(dto);
    res.setHeader('Location', `/api/v1/usuarios/${usuario.id}`);
    return usuario;
  }

  @Get(':id')
  @ApiOperation({ operationId: 'obtenerUsuario', summary: 'Usuario por id (sin datos de contraseña)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID numérico del usuario', example: 1 })
  @ApiOkResponse({ description: 'Usuario encontrado', type: UsuarioOutDto })
  @ApiBadRequestResponse({ description: 'id no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Usuario inexistente', content: PROBLEM_JSON })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UsuarioOutDto> {
    return this.usuariosService.obtenerPorId(id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'modificarUsuario', summary: 'Actualiza solo los campos presentes' })
  @ApiParam({ name: 'id', type: Number, description: 'ID numérico del usuario', example: 1 })
  @ApiOkResponse({ description: 'Usuario actualizado', type: UsuarioOutDto })
  @ApiBadRequestResponse({ description: 'id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Usuario inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModificarUsuarioDto,
  ): Promise<UsuarioOutDto> {
    return this.usuariosService.modificar(id, dto);
  }
}