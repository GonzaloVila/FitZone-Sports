/**
 * Resolucion y normalizacion de los dos documentos OpenAPI que se comparan.
 *
 * La idea central: comparar la FORMA CRUDA de los documentos no sirve. El
 * contrato y el codigo expresan lo mismo de forma distinta, y esas diferencias
 * de representacion no son errores. Por eso aca se resuelve todo a una forma
 * canonica antes de comparar:
 *
 *   - Un enum con nombre en el contrato y uno inline en el codigo quedan igual
 *     si tienen los mismos valores.
 *   - Una respuesta `$ref: #/components/responses/NotFound` y la misma escrita
 *     en el lugar quedan iguales si el body resuelto coincide.
 *
 * Regla dura de este archivo: NUNCA tira una excepcion. Un `$ref` a un destino
 * inexistente, un `properties` que es un string, un array donde se espera un
 * objeto: todo eso tiene que terminar como un hallazgo reportado, nunca como un
 * `TypeError` que tumbe la corrida. Un comparador que se cae no informa nada,
 * y peor: informa "0 diferencias" si nadie mira el exit code.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Nodo = unknown;

/** Schema OpenAPI reducido a lo comparable, con los-ruidos de representacion ya eliminados. */
export interface EsquemaCanonico {
  tipo?: string;
  formato?: string;
  anulable?: boolean;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  writeOnly?: boolean;
  default?: unknown;
  /** Claves en el orden en que aparecen. El orden de claves de un objeto JSON no es normativo. */
  propiedades?: Record<string, EsquemaCanonico>;
  /** Ordenado como conjunto: el orden del array `required` no significa nada en OpenAPI. */
  requeridas?: string[];
  additionalProperties?: boolean;
  oneOf?: EsquemaCanonico[];
  /** Un $ref que no existe en el documento. Se reporta como hallazgo, no se propaga. */
  noResuelto?: string;
  /** Un $ref que ya estaba en la cadena actual. Se corta aca para no ciclar. */
  ciclo?: string;
}

export interface ParametroCanonico {
  name: string;
  in: string;
  required: boolean;
  esquema: EsquemaCanonico;
}

export interface BodyCanonico {
  required: boolean;
  /** Media type -> esquema canonico. */
  contenido: Record<string, EsquemaCanonico>;
}

export interface RespuestaCanonica {
  /** Media type -> esquema canonico. */
  contenido: Record<string, EsquemaCanonico>;
}

export interface OperacionCanonica {
  operationId?: string;
  summary?: string;
  tags: string[];
  parametros: ParametroCanonico[];
  requestBody?: BodyCanonico;
  respuestas: Record<string, RespuestaCanonica>;
}

export interface DocumentoCanonico {
  /** servers[0].url, del que sale el prefijo de todas las rutas. */
  prefijo: string;
  globalSecurity?: unknown;
  esquemas: Record<string, EsquemaCanonico>;
  /** "GET /usuarios" -> operacion. */
  operaciones: Record<string, OperacionCanonica>;
  /** Nombres de components.responses. */
  respuestas: string[];
}

const METODOS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

const PREFIJO_COMPONENTES = '#/components/';
const MAX_PROFUNDIDAD = 24;

// ---------------------------------------------------------------------------
// Lectura defensiva
// ---------------------------------------------------------------------------

function comoObjeto(valor: Nodo): Record<string, Nodo> | undefined {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return undefined;
  return valor as Record<string, Nodo>;
}

function texto(valor: Nodo): string | undefined {
  return typeof valor === 'string' ? valor : undefined;
}

function numero(valor: Nodo): number | undefined {
  return typeof valor === 'number' ? valor : undefined;
}

function booleano(valor: Nodo): boolean | undefined {
  return typeof valor === 'boolean' ? valor : undefined;
}

function arreglo(valor: Nodo): Nodo[] {
  return Array.isArray(valor) ? valor : [];
}

/** Un valor de enum puede ser cualquier primitivo; se compara como texto. */
function textoDeEnum(valor: Nodo): string {
  if (valor === null) return 'null';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

// ---------------------------------------------------------------------------
// Resolucion de $ref
// ---------------------------------------------------------------------------

interface Contexto {
  doc: Record<string, Nodo>;
  /** Cache de punteros JSON, para no recorrer el mismo schema dos veces. */
  pila: string[];
}

/** Devuelve el valor al que apunta un `#/a/b/c`, o undefined si no existe. Nunca tira. */
function puntero(doc: Record<string, Nodo>, ref: string): Nodo {
  if (!ref.startsWith('#/')) return undefined;
  let actual: Nodo = doc;
  for (const segmento of ref.slice(2).split('/')) {
    // Los JSON Pointer escapan `~0` y `~1`; el contrato no los usa, pero no
    // cuesta nada respetarlos y evita surprises si alguien los agrega.
    const limpio = segmento.replace(/~1/g, '/').replace(/~0/g, '~');
    const objeto = comoObjeto(actual);
    if (!objeto) return undefined;
    actual = objeto[limpio];
  }
  return actual;
}

function esRef(nodo: Nodo): nodo is { $ref: string } {
  const o = comoObjeto(nodo);
  const ref = o ? texto(o.$ref) : undefined;
  return ref !== undefined;
}

// ---------------------------------------------------------------------------
// Canonicalizacion de schemas
// ---------------------------------------------------------------------------

/** Fusiona dos schemas allOf. El contrato no los usa, pero NestJS si. */
function fusionar(a: EsquemaCanonico, b: EsquemaCanonico): EsquemaCanonico {
  const salida: EsquemaCanonico = { ...a };
  for (const [clave, valor] of Object.entries(b)) {
    if (valor === undefined) continue;
    if (clave === 'propiedades') {
      salida.propiedades = { ...(a.propiedades ?? {}), ...(b.propiedades ?? {}) };
    } else if (clave === 'requeridas') {
      salida.requeridas = [...new Set([...(a.requeridas ?? []), ...(b.requeridas ?? [])])].sort();
    } else if (clave === 'enum') {
      salida.enum = [...new Set([...(a.enum ?? []), ...(b.enum ?? [])])].sort();
    } else if (clave === 'oneOf') {
      salida.oneOf = [...(a.oneOf ?? []), ...(b.oneOf ?? [])];
    } else if (clave === 'noResuelto' || clave === 'ciclo') {
      salida[clave] = valor as string;
    } else {
      (salida as Record<string, unknown>)[clave] = valor;
    }
  }
  return salida;
}

export function canonicalizarEsquema(nodo: Nodo, ctx: Contexto, profundidad = 0): EsquemaCanonico {
  if (profundidad > MAX_PROFUNDIDAD) return {};
  const objeto = comoObjeto(nodo);
  if (!objeto) return {};

  // 1) $ref: se resuelve y se sigue. Un ciclo se corta con un marcador.
  if (esRef(objeto)) {
    const ref = objeto.$ref;
    if (ctx.pila.includes(ref)) return { ciclo: ref };
    const destino = puntero(ctx.doc, ref);
    if (destino === undefined) return { noResuelto: ref };
    ctx.pila.push(ref);
    try {
      return canonicalizarEsquema(destino, ctx, profundidad + 1);
    } finally {
      ctx.pila.pop();
    }
  }

  // 2) allOf: se aplana, porque comparar la lista de pedazos no dice nada.
  if (Array.isArray(objeto.allOf)) {
    return arreglo(objeto.allOf).reduce<EsquemaCanonico>(
      (acc, pieza) => fusionar(acc, canonicalizarEsquema(pieza, ctx, profundidad + 1)),
      {},
    );
  }

  const salida: EsquemaCanonico = {};

  salida.tipo = texto(objeto.type);
  salida.formato = texto(objeto.format);
  salida.anulable = booleano(objeto.nullable);
  salida.minLength = numero(objeto.minLength);
  salida.maxLength = numero(objeto.maxLength);
  salida.pattern = texto(objeto.pattern);
  salida.minimum = numero(objeto.minimum);
  salida.maximum = numero(objeto.maximum);
  salida.writeOnly = booleano(objeto.writeOnly);
  salida.additionalProperties = booleano(objeto.additionalProperties);
  if ('default' in objeto) salida.default = objeto.default;

  if (Array.isArray(objeto.enum)) {
    // Como conjunto ordenado: el orden del enum no es normativo, y el contrato
    // y el codigo no necesariamente los declaran en el mismo orden.
    salida.enum = [...new Set(objeto.enum.map(textoDeEnum))].sort();
  }

  if (Array.isArray(objeto.required)) {
    salida.requeridas = [...new Set(objeto.required.map(textoDeEnum))].sort();
  }

  const propiedades = comoObjeto(objeto.properties);
  if (propiedades) {
    const mapa: Record<string, EsquemaCanonico> = {};
    for (const [nombre, esquema] of Object.entries(propiedades)) {
      mapa[nombre] = canonicalizarEsquema(esquema, ctx, profundidad + 1);
    }
    salida.propiedades = mapa;
  }

  if (Array.isArray(objeto.oneOf)) {
    salida.oneOf = arreglo(objeto.oneOf).map((p) => canonicalizarEsquema(p, ctx, profundidad + 1));
  }

  return salida;
}

// ---------------------------------------------------------------------------
// Canonicalizacion de parametros
// ---------------------------------------------------------------------------

function canonicalizarParametro(nodo: Nodo, ctx: Contexto): ParametroCanonico | undefined {
  const objeto = comoObjeto(nodo);
  if (!objeto) return undefined;
  if (!esRef(objeto)) {
    // Un parametro sin $ref pero con schema inline: se normaliza igual.
    const name = texto(objeto.name);
    if (name === undefined) return undefined;
    return {
      name,
      in: texto(objeto.in) ?? 'query',
      required: booleano(objeto.required) ?? false,
      esquema: canonicalizarEsquema(objeto.schema, ctx),
    };
  }
  const destino = puntero(ctx.doc, objeto.$ref);
  if (destino === undefined) {
    return { name: objeto.$ref, in: '$ref', required: false, esquema: { noResuelto: objeto.$ref } };
  }
  return canonicalizarParametro(destino, ctx);
}

/**
 * Fusiona los parametros de nivel de path item con los de la operacion.
 *
 * Este es el caso que produjo 38 falsos positivos la primera vez: el contrato
 * define `socio_id` una sola vez en `/socios/{socio_id}/membresias` y lo reusa
 * en cada metodo, mientras que el codigo lo declara operacion por operacion. Sin
 * esta fusion, todo parametro de ruta parece faltar en el contrato.
 *
 * La operacion pisa al path item cuando coinciden name + in, que es lo que dice
 * la especificacion de OpenAPI.
 */
export function fusionarParametros(
  dePathItem: Nodo,
  deOperacion: Nodo,
  ctx: Contexto,
): ParametroCanonico[] {
  const clave = (p: ParametroCanonico) => `${p.in}:${p.name}`;
  const mapa = new Map<string, ParametroCanonico>();

  for (const bruto of [...arreglo(dePathItem), ...arreglo(deOperacion)]) {
    const p = canonicalizarParametro(bruto, ctx);
    if (p) mapa.set(clave(p), p);
  }

  return [...mapa.values()].sort((a, b) => clave(a).localeCompare(clave(b)));
}

// ---------------------------------------------------------------------------
// Canonicalizacion de requestBody y responses
// ---------------------------------------------------------------------------

function canonicalizarContenido(nodo: Nodo, ctx: Contexto): Record<string, EsquemaCanonico> {
  const objeto = comoObjeto(nodo);
  if (!objeto) return {};
  const salida: Record<string, EsquemaCanonico> = {};
  for (const [mediaType, media] of Object.entries(objeto)) {
    salida[mediaType] = canonicalizarEsquema(comoObjeto(media)?.schema, ctx);
  }
  return salida;
}

function canonicalizarBody(nodo: Nodo, ctx: Contexto): BodyCanonico | undefined {
  if (nodo === undefined || nodo === null) return undefined;
  if (esRef(nodo)) {
    const destino = puntero(ctx.doc, nodo.$ref);
    if (destino === undefined) {
      return { required: false, contenido: { $ref: { noResuelto: nodo.$ref } } };
    }
    return canonicalizarBody(destino, ctx);
  }
  const objeto = comoObjeto(nodo);
  if (!objeto) return undefined;
  return {
    required: booleano(objeto.required) ?? false,
    contenido: canonicalizarContenido(objeto.content, ctx),
  };
}

function canonicalizarRespuesta(nodo: Nodo, ctx: Contexto): RespuestaCanonica {
  if (nodo === undefined || nodo === null) return { contenido: {} };
  if (esRef(nodo)) {
    const destino = puntero(ctx.doc, nodo.$ref);
    if (destino === undefined) return { contenido: { $ref: { noResuelto: nodo.$ref } } };
    return canonicalizarRespuesta(destino, ctx);
  }
  return { contenido: canonicalizarContenido(comoObjeto(nodo)?.content, ctx) };
}

// ---------------------------------------------------------------------------
// Documento completo
// ---------------------------------------------------------------------------

/**
 * Saca el prefijo de ruta de un `servers[0].url`.
 *
 * El contrato declara `url: http://localhost:3000/api/v1`, o sea una URL
 * completa, pero lo que hay que quitarle a cada path es solo la parte de ruta,
 * `/api/v1`. Comparar el path contra la URL entera es lo que hacia que todas
 * las rutas parecieran distintas: exactamente el bug que hoy desarrollo el
 * comparador ad-hoc. Si la `url` ya es relativa (`/api/v1`), se usa tal cual.
 */
function prefijoDeUrl(valor: string): string {
  try {
    return new URL(valor).pathname;
  } catch {
    return valor;
  }
}

/** Quita el prefijo a una ruta, si lo tiene. */
export function quitarPrefijo(ruta: string, prefijo: string): string {
  if (prefijo === '' || prefijo === '/') return ruta;
  const limpio = prefijo.replace(/\/+$/, '');
  if (ruta === limpio) return '/';
  return ruta.startsWith(`${limpio}/`) ? ruta.slice(limpio.length) : ruta;
}

/**
 * Canonicaliza un documento OpenAPI completo.
 *
 * `prefijoAlternativo` existe por una asimetria real entre los dos documentos: el
 * contrato declara `servers: [{url: 'http://localhost:3000/api/v1'}]`, de donde se
 * saca el prefijo, pero el documento que genera NestJS tiene `servers: []` y las
 * rutas ya traen `/api/v1` adentro porque el prefijo global se aplico al montar los
 * controllers. Sin forzar el mismo prefijo en los dos lados, cada ruta del
 * contrato quedaria como `/socios` y la del codigo como `/api/v1/socios`, y las
 * 19 operaciones desalinearian.
 */
export function canonicalizarDocumento(bruto: Nodo, prefijoAlternativo?: string): DocumentoCanonico {
  const doc = comoObjeto(bruto) ?? {};
  const ctx: Contexto = { doc, pila: [] };

  // servers es un array de objetos {url, description}. Del primero sale el
  // prefijo global que el backend antepone a todas las rutas.
  const primerServer = comoObjeto(arreglo(doc.servers)[0]);
  const prefijo = prefijoAlternativo ?? texto(primerServer?.url) ?? '';
  const prefijoRuta = prefijoDeUrl(prefijo);

  const esquemas: Record<string, EsquemaCanonico> = {};
  const componentes = comoObjeto(doc.components);
  const crudos = comoObjeto(componentes?.schemas);
  for (const [nombre, esquema] of Object.entries(crudos ?? {})) {
    esquemas[nombre] = canonicalizarEsquema(esquema, ctx);
  }

  const respuestas = Object.keys(componentes?.responses ?? {}).sort();

  const operaciones: Record<string, OperacionCanonica> = {};
  for (const [rutaCruda, pathItem] of Object.entries(comoObjeto(doc.paths) ?? {})) {
    const item = comoObjeto(pathItem);
    if (!item) continue;
    const ruta = quitarPrefijo(rutaCruda, prefijoRuta);

    for (const metodo of METODOS) {
      const op = comoObjeto(item[metodo]);
      if (!op) continue;

      const codigos: Record<string, RespuestaCanonica> = {};
      for (const [codigo, respuesta] of Object.entries(comoObjeto(op.responses) ?? {})) {
        codigos[codigo] = canonicalizarRespuesta(respuesta, ctx);
      }

      operaciones[`${metodo.toUpperCase()} ${ruta}`] = {
        operationId: texto(op.operationId),
        summary: texto(op.summary),
        tags: arreglo(op.tags).map(textoDeEnum).sort(),
        parametros: fusionarParametros(item.parameters, op.parameters, ctx),
        requestBody: canonicalizarBody(op.requestBody, ctx),
        respuestas: codigos,
      };
    }
  }

  return {
    prefijo: prefijoRuta,
    globalSecurity: doc.security,
    esquemas,
    operaciones,
    respuestas,
  };
}

export function crearContexto(doc: unknown): Contexto {
  return { doc: comoObjeto(doc) ?? {}, pila: [] };
}
