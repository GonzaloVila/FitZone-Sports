import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiNoContentResponse,
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
import { SocioIn } from '../dtos/socio-in.dto';
import { ListarSociosQueryDto } from '../dtos/listar-socios-query.dto';
import { SocioPatch } from '../dtos/socio-patch.dto';
import { SocioOut } from '../dtos/socio-out.dto';
import { SociosService } from '../services/socios.service';

@ApiTags('socios')
@ApiExtraModels(Problem)
@Controller('socios')
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

  @Post()
  @ApiOperation({ operationId: 'crearSocio', summary: 'Alta de socio (RF-02)' })
  @ApiCreatedResponse({
    description: 'Socio creado (y su membresía inicial si se indicó plan)',
    type: SocioOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/socios/2' } },
    },
  })
  @ApiBadRequestResponse({ description: 'Solicitud mal formada (JSON inválido)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Usuario a convertir no existe (404)', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'El usuario ya es socio (conflicto de unicidad)',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos o referencia inexistente (ValidationPipe/P2003)',
    content: PROBLEM_JSON,
  })
  async crear(
    @Body() dto: SocioIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SocioOut> {
    const socio = await this.sociosService.crear(dto);
    res.setHeader('Location', `/api/v1/socios/${socio.id}`);
    return socio;
  }

  // Antes que @Get(':socio_id') por el mismo motivo que en UsuariosController.
  @Get()
  @ApiOperation({ operationId: 'listarSocios', summary: 'Listado de socios con filtros' })
  @ApiOkResponse({ description: 'Listado de socios', type: [SocioOut] })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() dto: ListarSociosQueryDto): Promise<SocioOut[]> {
    return this.sociosService.listar(dto);
  }

  @Get(':socio_id')
  @ApiOperation({ operationId: 'obtenerSocio', summary: 'Obtener socio por id' })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Socio encontrado', type: SocioOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  obtener(@Param('socio_id', ParseIntPipe) socioId: number): Promise<SocioOut> {
    return this.sociosService.obtenerPorId(socioId);
  }

  @Patch(':socio_id')
  @ApiOperation({ operationId: 'modificarSocio', summary: 'Modificar parcialmente un socio' })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Socio actualizado', type: SocioOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos o sede de origen inexistente (P2003)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('socio_id', ParseIntPipe) socioId: number,
    @Body() dto: SocioPatch,
  ): Promise<SocioOut> {
    return this.sociosService.modificar(socioId, dto);
  }

  @Delete(':socio_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'dejarDeSerSocio', summary: 'Dejar de ser socio' })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiNoContentResponse({ description: 'Socio dado de baja (sin cuerpo)' })
  @ApiBadRequestResponse({ description: 'socio_id no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  eliminar(@Param('socio_id', ParseIntPipe) socioId: number): Promise<void> {
    return this.sociosService.dejarDeSerSocio(socioId);
  }
}
