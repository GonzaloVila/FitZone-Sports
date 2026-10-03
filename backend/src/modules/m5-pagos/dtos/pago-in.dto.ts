import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
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
    enum: ['RESERVA_CANCHA', 'MEMBRESIA'],
    description: 'Discriminante del concepto cobrado.',
    example: 'RESERVA_CANCHA',
  })
  @IsIn(['RESERVA_CANCHA', 'MEMBRESIA'])
  tipo!: ConceptoReservaCancha['tipo'] | ConceptoMembresia['tipo'];

  @ApiProperty({ type: 'integer', required: false, example: 7 })
  @IsInt()
  @Min(1)
  reserva_cancha_id?: number;

  @ApiProperty({ type: 'integer', required: false, example: 3 })
  @IsInt()
  @Min(1)
  membresia_id?: number;
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
      return value.reserva_cancha_id !== undefined && value.membresia_id === undefined;
    }
    return value.membresia_id !== undefined && value.reserva_cancha_id === undefined;
  }

  defaultMessage(args: ValidationArguments): string {
    const concepto = args.value as ConceptoPagoIn | undefined;

    if (concepto === undefined || concepto === null) {
      return 'concepto es obligatorio (RESERVA_CANCHA o MEMBRESIA).';
    }

    if (concepto.tipo === 'RESERVA_CANCHA') {
      return concepto.reserva_cancha_id === undefined
        ? 'Un concepto RESERVA_CANCHA requiere reserva_cancha_id.'
        : 'Un concepto RESERVA_CANCHA no admite membresia_id.';
    }

    return concepto.membresia_id === undefined
      ? 'Un concepto MEMBRESIA requiere membresia_id.'
      : 'Un concepto MEMBRESIA no admite reserva_cancha_id.';
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
@ApiExtraModels(ConceptoReservaCancha, ConceptoMembresia)
export class PagoIn {
  @ApiProperty({
    description:
      'Concepto cobrado. La rama la elige `tipo` y solo admite el id de esa rama ' +
      '(es el `oneOf` del contrato). El monto NO se manda: lo computa la regla de ' +
      'negocio del módulo que origina el cobro.',
    oneOf: [
      { $ref: getSchemaPath(ConceptoReservaCancha) },
      { $ref: getSchemaPath(ConceptoMembresia) },
    ],
  })
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
    description:
      'Token de la pasarela (RNF-02); nunca se envía ni almacena la tarjeta.',
    example: 'tok_aprobado_123',
  })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({
    type: 'string',
    default: 'ARS',
    description: 'Moneda del cobro. Solo ARS por ahora.',
    example: 'ARS',
  })
  // Opcional de verdad: el contrato lo declara con `default: ARS` fuera de
  // `required`, así que omitirlo tiene que pasar. Sin `@IsOptional`, `@IsIn`
  // correría contra `undefined` y un POST sin `moneda` —el caso normal— daría
  // 422. El default a ARS lo aplica el service (que es donde vive la regla),
  // no el DTO.
  @IsOptional()
  @IsIn(['ARS'])
  moneda?: string;
}