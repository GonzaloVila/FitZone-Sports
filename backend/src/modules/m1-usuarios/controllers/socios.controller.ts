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
import { ProblemDetailsDto } from '../../../commons/swagger/problem-details.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { CrearSocioDto } from '../dtos/crear-socio.dto';
import { ModificarSocioDto } from '../dtos/modificar-socio.dto';
import { SocioOutDto } from '../dtos/socio-out.dto';
import { SociosService } from '../services/socios.service';

@ApiTags('M1 Socios')
@ApiExtraModels(ProblemDetailsDto)
@Controller('socios')
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

  @Post()
  @ApiOperation({ operationId: 'crearSocio', summary: 'Alta de socio (RF-02)' })
  @ApiCreatedResponse({
    description: 'Socio creado (y su membresía inicial si se indicó plan)',
    type: SocioOutDto,
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
    @Body() dto: CrearSocioDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SocioOutDto> {
    const socio = await this.sociosService.crear(dto);
    res.setHeader('Location', `/api/v1/socios/${socio.id}`);
    return socio;
  }

  @Get(':socioId')
  @ApiOperation({ operationId: 'obtenerSocio', summary: 'Socio por id' })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Socio encontrado', type: SocioOutDto })
  @ApiBadRequestResponse({ description: 'socioId no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  obtener(@Param('socioId', ParseIntPipe) socioId: number): Promise<SocioOutDto> {
    return this.sociosService.obtenerPorId(socioId);
  }

  @Patch(':socioId')
  @ApiOperation({ operationId: 'modificarSocio', summary: 'Modifica la sede de origen' })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Socio actualizado', type: SocioOutDto })
  @ApiBadRequestResponse({ description: 'socioId no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos o sede de origen inexistente (P2003)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: ModificarSocioDto,
  ): Promise<SocioOutDto> {
    return this.sociosService.modificar(socioId, dto);
  }

  @Delete(':socioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'dejarDeSerSocio', summary: 'Deja de ser socio (usuario vuelve a EXTERNO)' })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID numérico del socio', example: 2 })
  @ApiNoContentResponse({ description: 'Socio dado de baja (sin cuerpo)' })
  @ApiBadRequestResponse({ description: 'socioId no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  eliminar(@Param('socioId', ParseIntPipe) socioId: number): Promise<void> {
    return this.sociosService.dejarDeSerSocio(socioId);
  }
}
