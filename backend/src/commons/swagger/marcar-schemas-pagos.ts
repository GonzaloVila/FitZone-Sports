import type { OpenAPIObject, ReferenceObject, SchemaObject } from '@nestjs/swagger';

const REF = '#/components/schemas/';

/**
 * Los decorators de `@nestjs/swagger` no pueden expresar dos cosas que el contrato
 * sí declara para M5, así que se corrigen sobre el documento ya generado, igual que
 * `markRequestSchemasClosed()`. Va después de `SwaggerModule.createDocument()` y
 * antes de `SwaggerModule.setup()`, que es donde el documento queda congelado.
 *
 * 1. `ConceptoPago` como schema CON NOMBRE. El `oneOf` del contrato es un schema en
 *    sí, y tanto `PagoIn.concepto` como `PagoOut.concepto` lo referencian. Con
 *    decoradores, el `oneOf` se emite donde vive la propiedad: el documento sale
 *    con el `oneOf` inline y sus tres campos (`tipo` y los dos ids) declarados al
 *    mismo nivel, o sea describiendo un objeto que nunca se usa mientras el `oneOf`
 *    real desaparece. Un `@ApiProperty({ oneOf })` sobre una propiedad no puede
 *    producir un schema cuyo CUERPO sea el `oneOf`, y `@ApiSchema()` de Nest 12 solo
 *    acepta `name` y `description`.
 *
 * 2. `EstadoPago` como enum con nombre, por la misma razón.
 *
 * 3. `ConceptoReservaCancha` y `ConceptoMembresia` se BORRAN del documento. Son las
 *    clases con las que el DTO valida el `oneOf` en runtime, y `@ApiExtraModels` las
 *    registra como schemas con nombre, pero el contrato NO las tiene: define las dos
 *    ramas inline dentro del `oneOf`. Si se dejaran, el documento publicaría dos
 *    schemas que el cliente no encuentra en el contrato.
 *
 * Lo que NO se hace acá: tocar el resto de `PagoIn`/`PagoOut` a mano. Eso sale de los
 * decoradores de los DTOs, y si algo de esos dos se desalinea lo arregla el DTO, no
 * este archivo. Un schema escrito acá que el código no produce es documentación que
 * miente, que es peor que un `diff` en rojo.
 */
export function marcarSchemasDePagos(doc: OpenAPIObject): string[] {
  const schemas = doc.components?.schemas;
  if (!schemas) return [];

  schemas.ConceptoPago = conceptoPago();
  schemas.EstadoPago = estadoPago();
  delete schemas.ConceptoReservaCancha;
  delete schemas.ConceptoMembresia;

  const tocados = ['ConceptoPago', 'EstadoPago'];

  for (const nombre of ['PagoIn', 'PagoOut']) {
    const schema = schemas[nombre];
    if (!schema || esReferencia(schema)) continue;
    const propiedades = (schema as SchemaObject).properties;
    if (!propiedades?.concepto) continue;

    (propiedades.concepto as ReferenceObject) = { $ref: `${REF}ConceptoPago` };
    tocados.push(`${nombre}.concepto`);
  }

  const pagoOut = schemas.PagoOut;
  if (pagoOut && !esReferencia(pagoOut)) {
    const propiedades = (pagoOut as SchemaObject).properties;
    if (propiedades?.estado) {
      (propiedades.estado as ReferenceObject) = { $ref: `${REF}EstadoPago` };
      tocados.push('PagoOut.estado');
    }
  }

  return tocados.sort();
}

// Las ramas van INLINE, que es como las declara el contrato. Referenciarlas por
// `$ref` obligaría a que existan dos schemas con nombre que el contrato no tiene.
function conceptoPago(): SchemaObject {
  return {
    oneOf: [
      {
        type: 'object',
        required: ['tipo', 'reserva_cancha_id'],
        properties: {
          tipo: { type: 'string', enum: ['RESERVA_CANCHA'] },
          reserva_cancha_id: { type: 'integer' },
        },
        additionalProperties: false,
      },
      {
        type: 'object',
        required: ['tipo', 'membresia_id'],
        properties: {
          tipo: { type: 'string', enum: ['MEMBRESIA'] },
          membresia_id: { type: 'integer' },
        },
        additionalProperties: false,
      },
    ],
    description:
      'Un pago referencia estructuralmente UN solo concepto (reserva de cancha o ' +
      'membresía, herencia parte-todo).',
  };
}

function estadoPago(): SchemaObject {
  return { type: 'string', enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO'] };
}

function esReferencia(value: unknown): value is ReferenceObject {
  return typeof value === 'object' && value !== null && '$ref' in value;
}