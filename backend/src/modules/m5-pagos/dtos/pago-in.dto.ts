import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  registerDecorator,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { datosInvalidos } from '../../../commons/filters/problem.exception';
import { ConceptoPago } from '../entities/pago.entity';

// RNF-02: no hay NINGÚN campo donde mandar datos de tarjeta. `token` es el único
// medio de pago del contrato y está `writeOnly`: sale del cliente hacia la pasarela
// y nunca vuelve en `PagoOut`. La garantía no es de costumbre sino estructural:
// `additionalProperties: false` + el ValidationPipe con `forbidNonWhitelisted`.
// Si algún día se agrega un campo de tarjeta acá, RNF-02 deja de cumplirse por
// estructura, y por eso el test de RNF-02 se verifica leyendo el DTO y el schema,
// no ejecutando nada.

/**
 * Rama del `oneOf` para `ConceptoPago`: pago de una reserva de cancha.
 * Separada en su propia clase y no en un objeto inline porque el comparator de
 * contrato cuenta las alternativas del `oneOf` (2 vs 2) y el `@ApiExtraModels` de
 * `PagoIn` las registra para que las dos aparezcan.
 */
export class ConceptoReservaCancha {
  @ApiProperty({
    type: 'string',
    enum: ['RESERVA_CANCHA'],
    description: 'Pago de una reserva de cancha (PagoReserva).',
    example: 'RESERVA_CANCHA',
  })
  @IsIn(['RESERVA_CANCHA'])
  tipo!: 'RESERVA_CANCHA';

  @ApiProperty({
    type: 'integer',
    description: 'Reserva a pagar. El monto sale de su precio aplicado.',
    example: 7,
  })
  @IsInt()
  @Min(1)
  reserva_cancha_id!: number;
}

/** Rama del `oneOf` para `ConceptoPago`: pago de una renovación de membresía. */
export class ConceptoMembresia {
  @ApiProperty({
    type: 'string',
    enum: ['MEMBRESIA'],
    description: 'Pago de una renovación de membresía (PagoMembresia).',
    example: 'MEMBRESIA',
  })
  @IsIn(['MEMBRESIA'])
  tipo!: 'MEMBRESIA';

  @ApiProperty({
    type: 'integer',
    description: 'Membresía a pagar. El monto sale del precio de su plan.',
    example: 3,
  })
  @IsInt()
  @Min(1)
  membresia_id!: number;
}

/** Rama del `oneOf` para `ConceptoPago`: penalidad por cancelacion tardia de clase (RF-07). */
export class ConceptoReservaClase {
  @ApiProperty({
    type: 'string',
    enum: ['RESERVA_CLASE'],
    description: 'Pago de la penalidad por cancelación tardía de una clase (PagoReservaClase).',
    example: 'RESERVA_CLASE',
  })
  @IsIn(['RESERVA_CLASE'])
  tipo!: 'RESERVA_CLASE';

  @ApiProperty({
    type: 'integer',
    description: 'Reserva de clase a penalizar. El monto sale de la regla de RF-07 (50% del valor nominal).',
    example: 4,
  })
  @IsInt()
  @Min(1)
  reserva_clase_id!: number;
}

/**
 * El concepto como lo valida `class-validator`.
 *
 * El contrato modela `ConceptoPago` como `oneOf` con `additionalProperties: false`
 * en cada rama, o sea que la rama elegida prohíbe el id de la otra. `class-validator`
 * no tiene unions discriminadas, así que se modela una clase con los dos ids
 * opcionales y un validador que exige el par que corresponde al `tipo` y rechaza el
 * otro. Es la traducción literal de `oneOf`, no una aproximada.
 *
 * Con `whitelist: true` + `forbidNonWhitelisted: true` los dos ids están
 * permitidos como campos, así que la regla de "solo el id de mi rama" la tiene que
 * aplicar el validador de abajo; sin él, `{tipo: MEMBRESIA, reserva_cancha_id: 7}`
 * pasaría y el service no sabría qué cobrar.
 */
export class ConceptoPagoIn {
  @ApiProperty({
    type: 'string',
    enum: ['RESERVA_CANCHA', 'MEMBRESIA', 'RESERVA_CLASE'],
    description: 'Discriminante del concepto cobrado.',
    example: 'RESERVA_CANCHA',
  })
  @IsIn(['RESERVA_CANCHA', 'MEMBRESIA', 'RESERVA_CLASE'])
  tipo!: ConceptoReservaCancha['tipo'] | ConceptoMembresia['tipo'] | ConceptoReservaClase['tipo'];

  @ApiProperty({ type: 'integer', required: false, example: 7 })
  // `@IsOptional()` es OBLIGATORIO en los ids, por el mismo motivo que en
  // `moneda`: el `oneOf` manda el id de UNA sola rama, así que los otros llegan
  // `undefined`, y sin `@IsOptional` tanto `@IsInt()` como `@Min(1)` corren
  // contra `undefined` y un body bien formado da 422. El DTO se puede escribir sin
  // los otros ids sin que eso se confunda con "mandó un id inválido" — eso lo
  // juzga `ConceptoUnicoConstraint`.
  @IsOptional()
  @IsInt()
  @Min(1)
  reserva_cancha_id?: number;

  @ApiProperty({ type: 'integer', required: false, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  membresia_id?: number;

  @ApiProperty({ type: 'integer', required: false, example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  reserva_clase_id?: number;
}

/**
 * El `oneOf` del contrato, traducido a runtime.
 *
 * Se implementa como `ValidatorConstraint` y no como un `@Validate(Clase)` con un
 * método estático: esa forma no llega a ejecutarse para los mensajes (el `validate`
 * estático se confunde con el `validate` de la interfaz), y acá importa la
 * validación en sí, no solo el texto. `defaultMessage` devuelve el detalle exacto de
 * cada caso en vez de un "validation failed" genérico, porque estos mensajes se
 * leen en el 422.
 */
@ValidatorConstraint({ name: 'conceptoUnico', async: false })
class ConceptoUnico implements ValidatorConstraintInterface {
  validate(value: ConceptoPagoIn | undefined): boolean {
    // `undefined` lo cubre `@IsDefined`, que es el que pone el mensaje de "falta".
    // Igual hay que devolver acá en vez de dejar que reviente el `value.tipo`: si el
    // constraint tira un TypeError, el ValidationPipe lo convierte en 500 y un body
    // `{}` mal formado termina siendo un error de servidor.
    if (value === undefined || value === null) {
      return false;
    }

    if (value.tipo === 'RESERVA_CANCHA') {
      return value.reserva_cancha_id !== undefined && value.membresia_id === undefined && value.reserva_clase_id === undefined;
    }
    if (value.tipo === 'RESERVA_CLASE') {
      return value.reserva_clase_id !== undefined && value.reserva_cancha_id === undefined && value.membresia_id === undefined;
    }
    return value.membresia_id !== undefined && value.reserva_cancha_id === undefined && value.reserva_clase_id === undefined;
  }

  defaultMessage(args: ValidationArguments): string {
    const concepto = args.value as ConceptoPagoIn | undefined;

    if (concepto === undefined || concepto === null) {
      return 'concepto es obligatorio (RESERVA_CANCHA, MEMBRESIA o RESERVA_CLASE).';
    }

    if (concepto.tipo === 'RESERVA_CANCHA') {
      return concepto.reserva_cancha_id === undefined
        ? 'Un concepto RESERVA_CANCHA requiere reserva_cancha_id.'
        : 'Un concepto RESERVA_CANCHA no admite membresia_id ni reserva_clase_id.';
    }

    if (concepto.tipo === 'RESERVA_CLASE') {
      return concepto.reserva_clase_id === undefined
        ? 'Un concepto RESERVA_CLASE requiere reserva_clase_id.'
        : 'Un concepto RESERVA_CLASE no admite reserva_cancha_id ni membresia_id.';
    }

    return concepto.membresia_id === undefined
      ? 'Un concepto MEMBRESIA requiere membresia_id.'
      : 'Un concepto MEMBRESIA no admite reserva_cancha_id ni reserva_clase_id.';
  }
}

/**
 * Se registra con `registerDecorator` y no usando la clase directo como
 * decorador de propiedad: `ValidatorConstraint` tipa su retorno como decorador de
 * CLASE, y aplicarlo sobre una propiedad no compila.
 *
 * Los mensajes van en `defaultMessage` porque se devuelven en el 422 y un
 * "validation failed" genérico no le dice al cliente cuál de las dos reglas del
 * `oneOf` rompió.
 */
export function ConceptoUnicoConstraint(): PropertyDecorator {
  return (objeto, propiedad) => {
    registerDecorator({
      name: 'conceptoUnico',
      target: objeto.constructor,
      propertyName: propiedad as string,
      validator: new ConceptoUnico(),
    });
  };
}

// Registra las dos ramas del `oneOf` en el documento. Sin esto los `$ref` de
// `concepto` apuntan a schemas que no existen y `/docs-json` sale con referencias
// rotas, que además el comparador no puede resolver.
@ApiExtraModels()
export class PagoIn {
  // `concepto` se declara acá solo para que Nest lo registre y lo meta en el
  // `required` que pide el contrato; lo que se PUBLICA es el `$ref` a
  // `ConceptoPago`, y eso lo reemplaza `marcarSchemasDePagos()` sobre el documento
  // ya generado. Decorarlo con el `oneOf` inline emitía el `oneOf` junto a los tres
  // campos al mismo nivel, que es un objeto que el contrato no describe.
  @ApiProperty()
  @ValidateNested()
  @Type(() => ConceptoPagoIn)
  @ConceptoUnicoConstraint()
  // `@IsDefined` y no nada: `concepto` está en el `required` del contrato y es el
  // required DURO del cobro. `@ValidateNested` solo recorre el objeto si viene, así
  // que sin esto un body `{}` pasaba la validación y el service recibía undefined
  // en vez de un 422. (A `token` lo cubren `@IsString` y `@MinLength`, que sí corren
  // contra undefined.)
  @IsDefined()
  concepto!: ConceptoPagoIn;

  @ApiProperty({
    type: 'string',
    // `writeOnly` es RNF-02 en el contrato, y no es decorativo: es lo que le dice
    // al generador de clientes que este campo no debe viajar de vuelta. Acá solo
    // documenta; que el token NO vuelva en la respuesta lo garantiza `PagoOut`, que
    // ni lo declara.
    writeOnly: true,
    description:
      'Token de la pasarela (RNF-02); nunca se envía ni almacena la tarjeta.',
    example: 'tok_aprobado_123',
  })
  @IsString()
  @MinLength(1)
  token!: string;

  // Opcional de verdad: el contrato lo declara con `default: ARS` fuera de
  // `required`, así que omitirlo tiene que pasar. Sin `@IsOptional`, `@IsIn`
  // correría contra `undefined` y un POST sin `moneda` —el caso normal— daría
  // 422. El default a ARS lo aplica el service (que es donde vive la regla),
  // no el DTO.
  //
  // Y `@ApiPropertyOptional` y no `@ApiProperty`: el plugin del CLI de Swagger no
  // está activo en este proyecto, así que Nest marca como required todo lo que no
  // lleve el decorador opcional, y `moneda` aparecía en el `required` del documento
  // mientras el contrato la declara fuera de `required`.
  @ApiPropertyOptional({
    type: 'string',
    default: 'ARS',
    description: 'Moneda del cobro. Solo ARS por ahora.',
    example: 'ARS',
  })
  @IsOptional()
  @IsIn(['ARS'])
  moneda?: string;
}

/**
 * La conversión de la clase validada a la union del dominio (`ConceptoPago`).
 *
 * Vive acá, al lado de `ConceptoUnicoConstraint`, y no en el service porque es el
 * ÚNICO punto donde se cruza la frontera "objeto plano con los dos ids opcionales"
 * → "union con un solo id poblado". Todas las reglas sobre qué combinaciones son
 * válidas siguen viviendo en el constraint: esta función NO vuelve a decidir, solo
 * le da a TypeScript el tipo que el constraint ya garantizan.
 *
 * Sin esto, `obtenerParaCobro(concepto.reserva_cancha_id)` no compila —el campo es
 * `number | undefined`— y la salida sería un `!` que mentiría sobre el invariante o
 * un default silencioso que mandaría `undefined` a la consulta.
 */
export function conceptoDePago(concepto: ConceptoPagoIn): ConceptoPago {
  if (concepto.tipo === 'RESERVA_CANCHA') {
    if (concepto.reserva_cancha_id === undefined) {
      throw datosInvalidos('Un concepto RESERVA_CANCHA requiere reserva_cancha_id.');
    }
    return { tipo: 'RESERVA_CANCHA', reserva_cancha_id: concepto.reserva_cancha_id };
  }

  if (concepto.tipo === 'RESERVA_CLASE') {
    if (concepto.reserva_clase_id === undefined) {
      throw datosInvalidos('Un concepto RESERVA_CLASE requiere reserva_clase_id.');
    }
    return { tipo: 'RESERVA_CLASE', reserva_clase_id: concepto.reserva_clase_id };
  }

  if (concepto.membresia_id === undefined) {
    throw datosInvalidos('Un concepto MEMBRESIA requiere membresia_id.');
  }
  return { tipo: 'MEMBRESIA', membresia_id: concepto.membresia_id };
}