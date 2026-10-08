import {
  Body,
  Controller,
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
import { ReservaClaseIn } from '../dtos/reserva-clase-in.dto';
import { ListarReservasClaseQueryDto } from '../dtos/listar-reservas-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { ReservasClasesService } from '../services/reservas-clases.service';

@ApiTags('reservas-clases')
@ApiExtraModels(Problem)
@Controller()
export class ReservasClasesController {
  constructor(private readonly reservasService: ReservasClasesService) {}

  @Post('reservas-clases')
  @ApiOperation({
    operationId: 'crearReservaClase',
    summary: 'Reservar cupo en una clase',
  })
  @ApiCreatedResponse({
    description: 'Reserva confirmada con éxito',
    type: ReservaClaseOut,
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
    description:
      'La clase alcanzó su capacidad máxima, el socio ya tiene una reserva confirmada activa para esa clase, ' +
      'la reserva se intentó fuera de la ventana de 48 hs previas al inicio, o la clase ya comenzó o finalizó.',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  async crear(
    @Body() dto: ReservaClaseIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservaClaseOut> {
    const reserva = await this.reservasService.crearReservaClase(dto.claseId, dto);
    res.setHeader('Location', `/api/v1/reservas-clases/${reserva.id}`);
    return reserva;
  }

  @Get('reservas-clases/:reservaClaseId')
  @ApiOperation({
    operationId: 'obtenerReservaClase',
    summary: 'Obtener reserva de cupo por id',
  })
  @ApiParam({ name: 'reservaClaseId', type: 'integer', description: 'ID de la reserva', example: 10 })
  @ApiOkResponse({ description: 'Detalle de la reserva', type: ReservaClaseOut })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada', content: PROBLEM_JSON })
  obtener(
    @Param('reservaClaseId', ParseIntPipe) reservaClaseId: number,
  ): Promise<ReservaClaseOut> {
    return this.reservasService.obtenerReservaClase(reservaClaseId);
  }

  @Post('reservas-clases/:reservaClaseId/cancelaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'cancelarReservaClase',
    summary: 'Cancelar un cupo de clase (RF-07)',
  })
  @ApiParam({
    name: 'reservaClaseId',
    type: 'integer',
    description: 'ID de la reserva a cancelar',
    example: 10,
  })
  @ApiNoContentResponse({
    description:
      'Reserva cancelada y cupo liberado para la lista de espera. Con menos de 2 hs de ' +
      'anticipación se cobró la penalidad (RF-07) antes de liberar el cupo.',
  })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada', content: PROBLEM_JSON })
  cancelar(@Param('reservaClaseId', ParseIntPipe) reservaClaseId: number): Promise<void> {
    return this.reservasService.cancelarReservaClase(reservaClaseId);
  }

  @Get('reservas-clases')
  @ApiOperation({
    operationId: 'listarReservasClase',
    summary: 'Listado de reservas de clase con filtros',
  })
  @ApiOkResponse({
    description: 'Listado de reservas de clases',
    type: [ReservaClaseOut],
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() query: ListarReservasClaseQueryDto): Promise<ReservaClaseOut[]> {
    return this.reservasService.listarReservasClase(query);
  }
}
