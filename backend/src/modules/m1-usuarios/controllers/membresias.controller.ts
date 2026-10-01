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
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { MembresiaIn } from '../dtos/membresia-in.dto';
import { MembresiaOut } from '../dtos/membresia-out.dto';
import { MembresiaPatch } from '../dtos/membresia-patch.dto';
import { MembresiasService } from '../services/membresias.service';

@ApiTags('membresias')
@ApiExtraModels(Problem)
@Controller('socios/:socio_id/membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Post()
  @ApiOperation({
    operationId: 'crearMembresia',
    summary: 'Alta de membresía para un socio',
  })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiCreatedResponse({
    description: 'Membresía creada (única vigente por socio)',
    type: MembresiaOut,
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
    @Param('socio_id', ParseIntPipe) socioId: number,
    @Body() dto: MembresiaIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MembresiaOut> {
    const membresia = await this.membresiasService.crear(socioId, dto);
    res.setHeader('Location', `/api/v1/socios/${socioId}/membresias`);
    return membresia;
  }

  @Get()
  @ApiOperation({
    operationId: 'obtenerMembresia',
    summary: 'Membresía actual del socio',
  })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía vigente del socio', type: MembresiaOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio o membresía inexistente', content: PROBLEM_JSON })
  obtener(
    @Param('socio_id', ParseIntPipe) socioId: number,
  ): Promise<MembresiaOut> {
    return this.membresiasService.obtenerPorSocioId(socioId);
  }

  @Patch()
  @ApiOperation({
    operationId: 'modificarMembresia',
    summary: 'Cambiar plan o configuración de la membresía',
  })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía actualizada', type: MembresiaOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio o membresía inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('socio_id', ParseIntPipe) socioId: number,
    @Body() dto: MembresiaPatch,
  ): Promise<MembresiaOut> {
    return this.membresiasService.modificar(socioId, dto);
  }
}
