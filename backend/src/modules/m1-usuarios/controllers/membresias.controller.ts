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
import { CrearMembresiaDto } from '../dtos/crear-membresia.dto';
import { MembresiaOutDto } from '../dtos/membresia-out.dto';
import { MembresiaPatchDto } from '../dtos/membresia-patch.dto';
import { MembresiasService } from '../services/membresias.service';

@ApiTags('M1 Membresías')
@ApiExtraModels(ProblemDetailsDto)
@Controller('socios/:socioId/membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Post()
  @ApiOperation({
    operationId: 'crearMembresia',
    summary: 'Alta de membresía para un socio',
  })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID numérico del socio', example: 2 })
  @ApiCreatedResponse({
    description: 'Membresía creada (única vigente por socio)',
    type: MembresiaOutDto,
    headers: {
      Location: {
        description: 'URL del recurso creado',
        schema: { type: 'string', example: '/api/v1/socios/2/membresias' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Solicitud mal formada (JSON inválido)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'El socio ya tiene una membresía (relación 1:1)',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  async crear(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: CrearMembresiaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MembresiaOutDto> {
    const membresia = await this.membresiasService.crear(socioId, dto);
    res.setHeader('Location', `/api/v1/socios/${socioId}/membresias`);
    return membresia;
  }

  @Get()
  @ApiOperation({
    operationId: 'obtenerMembresia',
    summary: 'Membresía vigente del socio',
  })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía vigente del socio', type: MembresiaOutDto })
  @ApiBadRequestResponse({ description: 'socioId no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio o membresía inexistente', content: PROBLEM_JSON })
  obtener(
    @Param('socioId', ParseIntPipe) socioId: number,
  ): Promise<MembresiaOutDto> {
    return this.membresiasService.obtenerPorSocioId(socioId);
  }

  @Patch()
  @ApiOperation({
    operationId: 'modificarMembresia',
    summary: 'Cambiar plan o configuración de la membresía',
  })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía actualizada', type: MembresiaOutDto })
  @ApiBadRequestResponse({ description: 'socioId no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio o membresía inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: MembresiaPatchDto,
  ): Promise<MembresiaOutDto> {
    return this.membresiasService.modificar(socioId, dto);
  }
}
