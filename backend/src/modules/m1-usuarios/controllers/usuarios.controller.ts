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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CrearUsuarioDto } from '../dtos/crear-usuario.dto';
import { ModificarUsuarioDto } from '../dtos/modificar-usuario.dto';
import { UsuarioOutDto } from '../dtos/usuario-out.dto';
import { UsuariosService } from '../services/usuarios.service';

@ApiTags('M1 Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @ApiOperation({ operationId: 'crearUsuario', summary: 'Alta de usuario (perfil EXTERNO/RECEPCION/GERENTE)' })
  @ApiCreatedResponse({ type: UsuarioOutDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
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
  @ApiOkResponse({ type: UsuarioOutDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UsuarioOutDto> {
    return this.usuariosService.obtenerPorId(id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'modificarUsuario', summary: 'Actualiza solo los campos presentes' })
  @ApiOkResponse({ type: UsuarioOutDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  modificar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModificarUsuarioDto,
  ): Promise<UsuarioOutDto> {
    return this.usuariosService.modificar(id, dto);
  }
}