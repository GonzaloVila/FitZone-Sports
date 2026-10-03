import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { faltaIdempotencyKey } from '../../../commons/filters/problem.exception';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
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
}