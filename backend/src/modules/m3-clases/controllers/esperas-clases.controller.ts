import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
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
import { EsperaIn } from '../dtos/espera-in.dto';
import { EsperaOut } from '../dtos/espera-out.dto';
import { ListarEsperasClaseQueryDto } from '../dtos/listar-esperas-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { EsperasClasesService } from '../services/esperas-clases.service';

@ApiTags('esperas-clases')
@ApiExtraModels(Problem)
@Controller()
export class EsperasClasesController {
  constructor(private readonly esperasService: EsperasClasesService) {}

  @Post('clases/:claseId/espera')
  @ApiOperation({
    operationId: 'anotarseEnEspera',
    summary: 'Anotarse en la lista de espera de una clase (RF-08)',
  })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID de la clase completa', example: 1 })
  @ApiCreatedResponse({
    description: 'Inscripción en lista de espera registrada exitosamente',
    type: EsperaOut,
    headers: {
      Location: {
        description: 'URL de acceso a la solicitud de espera',
        schema: { type: 'string', example: '/api/v1/esperas-clases/4' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Socio en mora', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Clase o socio no encontrado', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description:
      'La clase todavía tiene cupos libres, el socio ya tiene una espera o una reserva activa ' +
      'para esa clase, o la clase ya comenzó o finalizó.',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  async anotarse(
    @Param('claseId', ParseIntPipe) claseId: number,
    @Body() dto: EsperaIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EsperaOut> {
    const espera = await this.esperasService.anotarseEnEspera(claseId, dto);
    res.setHeader('Location', `/api/v1/esperas-clases/${espera.id}`);
    return espera;
  }

  @Get('esperas-clases/:esperaId')
  @ApiOperation({
    operationId: 'obtenerEspera',
    summary: 'Obtener anotación de espera por id',
  })
  @ApiParam({ name: 'esperaId', type: 'integer', description: 'ID de la solicitud de espera', example: 4 })
  @ApiOkResponse({ description: 'Detalle de la solicitud de espera', type: EsperaOut })
  @ApiNotFoundResponse({ description: 'Solicitud de espera no encontrada', content: PROBLEM_JSON })
  obtener(@Param('esperaId', ParseIntPipe) esperaId: number): Promise<EsperaOut> {
    return this.esperasService.obtenerEspera(esperaId);
  }

  @Delete('esperas-clases/:esperaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'salirDeEspera',
    summary: 'Salir de la lista de espera (baja lógica)',
  })
  @ApiParam({ name: 'esperaId', type: 'integer', description: 'ID de la espera a cancelar', example: 4 })
  @ApiNoContentResponse({ description: 'Solicitud de espera dada de baja lógicamente (CANCELADO)' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'La solicitud ya fue confirmada previamente',
    content: PROBLEM_JSON,
  })
  salir(@Param('esperaId', ParseIntPipe) esperaId: number): Promise<void> {
    return this.esperasService.salirDeEspera(esperaId);
  }

  @Post('esperas-clases/:esperaId/confirmaciones')
  @ApiOperation({
    operationId: 'confirmarEspera',
    summary: 'Confirmar cupo desde la lista de espera (RF-08)',
  })
  @ApiParam({ name: 'esperaId', type: 'integer', description: 'ID de la espera notificada', example: 4 })
  @ApiCreatedResponse({
    description: 'Cupo confirmado y convertido a reserva de clase exitosamente',
    type: ReservaClaseOut,
    headers: {
      Location: {
        description: 'URL de acceso a la reserva creada',
        schema: { type: 'string', example: '/api/v1/reservas-clases/5' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'La espera no está notificada o el cupo fue tomado por otro socio',
    content: PROBLEM_JSON,
  })
  async confirmar(
    @Param('esperaId', ParseIntPipe) esperaId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservaClaseOut> {
    const reserva = await this.esperasService.confirmarEspera(esperaId);
    res.setHeader('Location', `/api/v1/reservas-clases/${reserva.id}`);
    return reserva;
  }

  @Get('esperas-clases')
  @ApiOperation({
    operationId: 'listarEsperasClase',
    summary: 'Listado de anotaciones de espera con filtros',
  })
  @ApiOkResponse({
    description: 'Listado de solicitudes en lista de espera',
    type: [EsperaOut],
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() query: ListarEsperasClaseQueryDto): Promise<EsperaOut[]> {
    return this.esperasService.listarEsperasClase(query);
  }
}
