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
import { CrearReservaClaseDto } from '../dtos/crear-reserva-clase.dto';
import { ReservaClaseOutDto } from '../dtos/reserva-clase-out.dto';
import { ReservasClasesService } from '../services/reservas-clases.service';

@ApiTags('reservas-clases')
@ApiExtraModels(ProblemDetailsDto)
@Controller()
export class ReservasClasesController {
  constructor(private readonly reservasService: ReservasClasesService) {}

  @Post('clases/:clase_id/reservas')
  @ApiOperation({
    operationId: 'reservarClase',
    summary: 'Reservar un cupo en clase grupal (RF-07)',
  })
  @ApiParam({ name: 'clase_id', type: Number, description: 'ID de la clase a reservar', example: 1 })
  @ApiCreatedResponse({
    description: 'Reserva confirmada con éxito',
    type: ReservaClaseOutDto,
    headers: {
      Location: {
        description: 'URL de acceso a la reserva confirmada',
        schema: { type: 'string', example: '/api/v1/reservas-clases/10' },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Socio en mora: cuota vencida no permite reservar con descuento',
    content: PROBLEM_JSON,
  })
  @ApiNotFoundResponse({ description: 'Clase o socio no encontrado', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'Cupo agotado o el socio ya tiene reserva confirmada activa',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Intento de reserva fuera de la ventana de 48 hs o clase en el pasado',
    content: PROBLEM_JSON,
  })
    async reservar(
      @Param('clase_id', ParseIntPipe) clase_id: number,
      @Body() dto: CrearReservaClaseDto,
      @Res({ passthrough: true }) res: Response,
    ): Promise<ReservaClaseOutDto> {
      const reserva = await this.reservasService.reservarClase(clase_id, dto);
    res.setHeader('Location', `/api/v1/reservas-clases/${reserva.id}`);
    return reserva;
  }

  @Get('reservas-clases/:reserva_id')
  @ApiOperation({
    operationId: 'obtenerReservaClase',
    summary: 'Consultar información de una reserva de clase (RF-07)',
  })
  @ApiParam({ name: 'reserva_id', type: Number, description: 'ID de la reserva', example: 10 })
  @ApiOkResponse({ description: 'Detalle de la reserva', type: ReservaClaseOutDto })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada', content: PROBLEM_JSON })
  obtener(@Param('reserva_id', ParseIntPipe) reserva_id: number): Promise<ReservaClaseOutDto> {
    return this.reservasService.obtenerReserva(reserva_id);
  }

  @Delete('reservas-clases/:reservaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'cancelarReserva',
    summary: 'Cancelar reserva de clase sin penalidad (RF-07)',
  })
  @ApiParam({ name: 'reservaId', type: Number, description: 'ID de la reserva a cancelar', example: 10 })
  @ApiNoContentResponse({ description: 'Reserva cancelada sin penalidad; cupo liberado para lista de espera' })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'Cancelación fuera de término: faltan menos de 2 horas para la clase',
    content: PROBLEM_JSON,
  })
  cancelar(@Param('reservaId', ParseIntPipe) reservaId: number): Promise<void> {
    return this.reservasService.cancelarReserva(reservaId);
  }
}
