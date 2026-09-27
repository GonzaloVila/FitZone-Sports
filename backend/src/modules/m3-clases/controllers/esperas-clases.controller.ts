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
import { ProblemDetailsDto } from '../../../commons/swagger/problem-details.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { CrearEsperaDto } from '../dtos/crear-espera.dto';
import { EsperaOutDto } from '../dtos/espera-out.dto';
import { EsperasClasesService } from '../services/esperas-clases.service';

@ApiTags('esperas-clases')
@ApiExtraModels(ProblemDetailsDto)
@Controller()
export class EsperasClasesController {
  constructor(private readonly esperasService: EsperasClasesService) {}

  @Post('clases/:claseId/espera')
  @ApiOperation({
    operationId: 'anotarseEnEspera',
    summary: 'Anotarse en lista de espera de una clase completa (RF-08)',
  })
  @ApiParam({ name: 'claseId', type: Number, description: 'ID de la clase completa', example: 1 })
  @ApiCreatedResponse({
    description: 'Inscripción en lista de espera registrada exitosamente',
    type: EsperaOutDto,
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
    description: 'La clase tiene cupos libres o el socio ya se encuentra anotado',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Clase ya finalizada o fecha pasada', content: PROBLEM_JSON })
  async anotarse(
    @Param('claseId', ParseIntPipe) claseId: number,
    @Body() dto: CrearEsperaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EsperaOutDto> {
    const espera = await this.esperasService.anotarseEnEspera(claseId, dto);
    res.setHeader('Location', `/api/v1/esperas-clases/${espera.id}`);
    return espera;
  }

  @Get('esperas-clases/:esperaId')
  @ApiOperation({
    operationId: 'obtenerEspera',
    summary: 'Consultar estado de una solicitud en lista de espera (RF-08)',
  })
  @ApiParam({ name: 'esperaId', type: Number, description: 'ID de la solicitud de espera', example: 4 })
  @ApiOkResponse({ description: 'Detalle de la solicitud de espera', type: EsperaOutDto })
  @ApiNotFoundResponse({ description: 'Solicitud de espera no encontrada', content: PROBLEM_JSON })
  obtener(@Param('esperaId', ParseIntPipe) esperaId: number): Promise<EsperaOutDto> {
    return this.esperasService.obtenerEspera(esperaId);
  }

  @Delete('esperas-clases/:esperaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'salirDeEspera',
    summary: 'Salir voluntariamente de la lista de espera (RF-08 - Baja Lógica)',
  })
  @ApiParam({ name: 'esperaId', type: Number, description: 'ID de la espera a cancelar', example: 4 })
  @ApiNoContentResponse({ description: 'Solicitud de espera dada de baja lógicamente (CANCELADO)' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'La solicitud ya fue confirmada previamente', content: PROBLEM_JSON })
  salir(@Param('esperaId', ParseIntPipe) esperaId: number): Promise<void> {
    return this.esperasService.salirDeEspera(esperaId);
  }

  @Post('esperas-clases/:esperaId/confirmacion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'confirmarEspera',
    summary: 'Confirmar cupo liberado (modalidad First-Come, First-Served) (RF-08)',
  })
  @ApiParam({ name: 'esperaId', type: Number, description: 'ID de la espera notificada', example: 4 })
  @ApiNoContentResponse({ description: 'Cupo confirmado y convertido a reserva de clase exitosamente' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'La espera no está notificada o el cupo fue tomado por otro socio',
    content: PROBLEM_JSON,
  })
  confirmar(@Param('esperaId', ParseIntPipe) esperaId: number): Promise<void> {
    return this.esperasService.confirmarEspera(esperaId);
  }
}
