import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import {
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
import { AforoOut } from '../dtos/aforo-out.dto';
import { ListarSedesQueryDto } from '../dtos/listar-sedes-query.dto';
import { SedeIn } from '../dtos/sede-in.dto';
import { SedeOut } from '../dtos/sede-out.dto';
import { IngresosService } from '../services/ingresos.service';
import { SedesService } from '../services/sedes.service';

@ApiTags('sedes')
@ApiExtraModels(Problem)
@Controller('sedes')
export class SedesController {
  constructor(
    private readonly sedesService: SedesService,
    private readonly ingresosService: IngresosService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listarSedes', summary: 'Listado de sedes' })
  @ApiOkResponse({ description: 'Listado de sedes', type: [SedeOut] })
  @ApiUnprocessableEntityResponse({ description: 'Parámetros de paginación inválidos', content: PROBLEM_JSON })
  listar(@Query() query: ListarSedesQueryDto): Promise<SedeOut[]> {
    return this.sedesService.listar(query.page ?? 1, query.per_page ?? 20);
  }

  @Post()
  @ApiOperation({ operationId: 'crearSede', summary: 'Alta de sede' })
  @ApiCreatedResponse({
    description: 'Sede creada',
    type: SedeOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/sedes/3' } },
    },
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Body() dto: SedeIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SedeOut> {
    const sede = await this.sedesService.crear(dto);
    res.setHeader('Location', `/api/v1/sedes/${sede.id}`);
    return sede;
  }

  @Get(':sede_id/aforo')
  @ApiOperation({ operationId: 'obtenerAforo', summary: 'Aforo actual de una sede (RF-05)' })
  @ApiParam({ name: 'sede_id', type: 'integer', description: 'ID numérico de la sede', example: 3 })
  @ApiOkResponse({ description: 'Aforo actual de la sede', type: AforoOut })
  @ApiNotFoundResponse({ description: 'Sede inexistente', content: PROBLEM_JSON })
  obtenerAforo(@Param('sede_id', ParseIntPipe) sedeId: number): Promise<AforoOut> {
    return this.ingresosService.obtenerAforo(sedeId);
  }
}
