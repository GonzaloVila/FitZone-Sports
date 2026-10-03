import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { faltaIdempotencyKey } from '../../../commons/filters/problem.exception';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { ListarPagosQueryDto } from '../dtos/listar-pagos-query.dto';
import { PagoIn } from '../dtos/pago-in.dto';
import { PagoOut } from '../dtos/pago-out.dto';
import { PagosService } from '../services/pagos.service';

@ApiTags('pagos')
@ApiExtraModels(Problem)
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post()
  // 201 explícito porque el default de POST en Nest es 201, pero el resto de este
  // controller lo pone: dejarlo implícito es lo que hace que un POST que un día
  // devuelva 200 parezca un descuido.
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    operationId: 'procesarPago',
    // Textos literales del contrato: el comparador los mira, así que parafrasear el
    // summary rompe el diff sin ganar nada.
    summary: 'Procesar un pago (RF-13)',
    description:
      'Cobro de una reserva de cancha (PagoReserva) o una renovación de membresía ' +
      '(PagoMembresia). Requiere la cabecera Idempotency-Key: si la clave ya fue ' +
      'usada, el unique del esquema responde 409 y la pasarela no se invoca de nuevo. ' +
      'El monto lo computa la regla de negocio (por precio aplicado o plan). Sin ' +
      'PATCH/DELETE: un cobro mal hecho se ANULA por POST /pagos/{pago_id}/anulaciones ' +
      'y se repaga con una nueva Idempotency-Key.',
  })
  // El `description` de la cabecera viene del parámetro `$ref` del contrato; copiarlo
  // acá es lo que permite que el documento muestre el texto aunque el cliente lo
  // lea del parámetro.
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única de idempotencia (el reintento con la misma clave no duplica el cobro).',
    schema: { type: 'string', example: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' },
  })
  @ApiCreatedResponse({
    description: 'Pago procesado',
    type: PagoOut,
    headers: {
      Location: {
        description: 'URL del recurso creado',
        schema: { type: 'string', example: '/api/v1/pagos/8' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Falta la cabecera Idempotency-Key', content: PROBLEM_JSON })
  // El 402 faltaba y el endpoint lo devuelve: sin esta línea el documento prometería
  // un cobro que nunca puede fallar así, que es peor que no declararlo.
  @ApiPaymentRequiredResponse({ description: 'Pago rechazado por la pasarela', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'El concepto del pago no existe', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'Idempotencia repetida o reserva ya cobrada',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async procesarPago(
    @Body() dto: PagoIn,
    // El nombre de la cabecera viene del contrato con guiones, así que el parámetro
    // no puede llamarse `idempotencyKey` salvo que se le diga el nombre exacto.
    @Res({ passthrough: true }) res: Response,
    // Por eso `@Headers('Idempotency-Key')`: Nest no convierte el guion a camelCase.
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ): Promise<PagoOut> {
    // El contrato la marca `required: true`, pero un header ausente en Express llega
    // como `undefined` y no dispara el ValidationPipe (que solo ve el body). Sin este
    // check, el service recibiría `undefined` como clave y el `@unique` de Prisma
    // reventaría con un 500 en vez de un 400 con el `title` que el contrato declara.
    if (!idempotencyKey) {
      throw faltaIdempotencyKey();
    }

    const pago = await this.pagosService.procesarPago(dto, idempotencyKey);
    res.setHeader('Location', `/api/v1/pagos/${pago.id}`);
    return pago;
  }

  // Declarado antes que `@Get(':pago_id')`: `/pagos` no cae en la ruta con parámetro,
  // pero el orden deja el listado primero como en el resto de los controllers.
  @Get()
  @ApiOperation({
    operationId: 'listarPagos',
    // Textos literales del contrato: el comparador los mira, así que parafrasear el
    // summary rompe el diff sin ganar nada.
    summary: 'Listado de pagos con filtros',
    description:
      'Filtros por usuario, estado, tipo de concepto, concepto concreto y período ' +
      '(lista blanca de parámetros) y paginación. Sin `estado` devuelve solo los APROBADO: ' +
      'es el único estado en el que el dinero se movió y existe comprobante. PENDIENTE, ' +
      'RECHAZADO y ANULADO se piden explícitamente con ?estado=, porque un pago anulado no ' +
      'se borra del histórico: se repaga con una nueva Idempotency-Key. `tipo` es el ' +
      'discriminante de ConceptoPago (RESERVA_CANCHA cruza con PagoReserva, MEMBRESIA con ' +
      'PagoMembresia). `desde` y `hasta` son días (YYYY-MM-DD) en hora local y forman un ' +
      'intervalo cerrado: ?desde=2026-03-01&hasta=2026-03-31 trae todo marzo.',
  })
  @ApiOkResponse({ description: 'Listado de pagos', type: [PagoOut] })
  @ApiUnprocessableEntityResponse({ description: 'Filtros o paginación inválidos', content: PROBLEM_JSON })
  listar(@Query() query: ListarPagosQueryDto): Promise<PagoOut[]> {
    return this.pagosService.listarPagos({
      usuarioId: query.usuario_id,
      estado: query.estado,
      tipo: query.tipo,
      reservaCanchaId: query.reserva_cancha_id,
      membresiaId: query.membresia_id,
      desde: query.desde,
      hasta: query.hasta,
      page: query.page ?? 1,
      perPage: query.per_page ?? 20,
    });
  }

  @Get(':pago_id')
  @ApiOperation({ operationId: 'obtenerPago', summary: 'Obtener pago por id' })
  @ApiParam({ name: 'pago_id', type: 'integer', description: 'ID numérico del pago', example: 8 })
  @ApiOkResponse({ description: 'Pago', type: PagoOut })
  @ApiNotFoundResponse({ description: 'Pago inexistente', content: PROBLEM_JSON })
  obtener(@Param('pago_id', ParseIntPipe) pagoId: number): Promise<PagoOut> {
    return this.pagosService.obtenerPago(pagoId);
  }

  @Post(':pago_id/anulaciones')
  // 204 explícito: el default de POST en Nest es 201, y dejar el 204 implícito es lo que
  // hace que un día un cambio de comportamiento pase inadvertido.
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'anularPago',
    // Textos literales del contrato.
    summary: 'Anular un pago',
    description:
      'Única forma de mover un pago hacia ANULADO (sin PATCH ni DELETE). Aplica a un pago ' +
      'PENDIENTE o APROBADO (por ej. cobro duplicado o mal hecho). Re-anular un pago ya ' +
      'ANULADO es idempotente: responde 204 sin cambios. Un pago RECHAZADO nunca se cobró y ' +
      'no es anulable: responde 409. El pago anulado no se borra del histórico: se repaga ' +
      'con una nueva Idempotency-Key.',
  })
  @ApiParam({ name: 'pago_id', type: 'integer', description: 'ID numérico del pago', example: 8 })
  @ApiNoContentResponse({ description: 'Pago anulado (sin cuerpo)' })
  @ApiNotFoundResponse({ description: 'Pago inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'El pago está RECHAZADO y no es anulable', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async anular(@Param('pago_id', ParseIntPipe) pagoId: number): Promise<void> {
    await this.pagosService.anularPago(pagoId);
  }

  @Get(':pago_id/comprobante')
  @ApiOperation({
    operationId: 'obtenerComprobante',
    // Textos literales del contrato, como en el POST.
    summary: 'Descargar comprobante PDF (RF-14)',
    description:
      'Genera/retorna el comprobante del pago aprobado (snapshot al momento del pago). ' +
      'Si el pago no fue aprobado (PENDIENTE/RECHAZADO/ANULADO) responde 409.',
  })
  // Sin esto Swagger emite `type: number` y el contrato declara el parametro como
  // `integer`: el diff contractual lo marca como diferencia de tipo. Es el mismo
  // `@ApiParam` que llevan los ids de los demas modulos.
  @ApiParam({ name: 'pago_id', type: 'integer', description: 'ID numérico del pago', example: 8 })
  @ApiOkResponse({
    description: 'Comprobante en PDF',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'El pago no existe o no tiene comprobante',
    content: PROBLEM_JSON,
  })
  @ApiConflictResponse({
    description: 'El pago no está aprobado y no tiene comprobante',
    content: PROBLEM_JSON,
  })
  // El `StreamableFile` es lo que hace que Nest mande los bytes tal cual, en vez de
  // serializar el Buffer a JSON — que además lo convertiría en `{"type":"Buffer",...}`.
  //
  // `passthrough: true` en el `@Res` es lo que permite poner el `Content-Disposition`
  // dinámico (el nombre lleva el id del pago) sin sacarle a Nest el control de la
  // respuesta: sin passthrough, este método tendría que hacer `res.send()` a mano y
  // ningún interceptor o filtro del proyecto volvería a pasar por esta respuesta.
  async obtenerComprobante(
    @Param('pago_id', ParseIntPipe) pagoId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const comprobante = await this.pagosService.obtenerComprobante(pagoId);

    res.setHeader('Content-Type', 'application/pdf');
    // `filename*` con RFC 5987 para que el nombre llegue bien si algún día tiene acentos;
    // el `filename` plano es el fallback para clientes viejos.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${comprobante.nombre}"; filename*=UTF-8''${encodeURIComponent(comprobante.nombre)}`,
    );

    return new StreamableFile(comprobante.buffer);
  }
}