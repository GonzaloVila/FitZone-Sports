import type {
  OpenAPIObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger';

const REF_PREFIX = '#/components/schemas/';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

function isReference(value: unknown): value is ReferenceObject {
  return typeof value === 'object' && value !== null && '$ref' in value;
}

/**
 * Nombres de los schemas referenciados por algún requestBody de nivel superior.
 *
 * No se baja a las propiedades: los $ref anidados apuntan a enums compartidos
 * (Rol, Plan, EstadoMembresia) que el contrato deja abiertos.
 */
function requestSchemaNames(doc: OpenAPIObject): string[] {
  const names = new Set<string>();

  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      const requestBody = operation?.requestBody;
      if (!requestBody || isReference(requestBody)) continue;

      for (const media of Object.values(requestBody.content ?? {})) {
        const schema = media.schema;
        if (!schema || !isReference(schema)) continue;

        const ref = schema.$ref;
        if (typeof ref === 'string' && ref.startsWith(REF_PREFIX)) {
          names.add(ref.slice(REF_PREFIX.length));
        }
      }
    }
  }

  return [...names];
}

/**
 * Cierra con additionalProperties: false los schemas de request, que es la
 * convencion del contrato. Necesario porque el ValidationPipe corre con
 * forbidNonWhitelisted: true y ya rechaza campos desconocidos en runtime:
 * dejarlo abierto en el documento seria documentar menos de lo que se exige.
 *
 * No toca schemas de respuesta, enums ni Problem.
 *
 * @returns nombres de los schemas que quedaron marcados en esta llamada.
 */
export function markRequestSchemasClosed(doc: OpenAPIObject): string[] {
  const schemas = doc.components?.schemas;
  if (!schemas) return [];

  const marked: string[] = [];

  for (const name of requestSchemaNames(doc)) {
    const schema = schemas[name];
    if (!schema || isReference(schema)) continue;
    if (schema.additionalProperties === false) continue;

    (schema as SchemaObject).additionalProperties = false;
    marked.push(name);
  }

  return marked.sort();
}
