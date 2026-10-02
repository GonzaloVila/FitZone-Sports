import type { DocumentoCanonico, EsquemaCanonico, OperacionCanonica, ParametroCanonico } from './resolver';

/**
 * Un desacuerdo entre el contrato y el codigo. Cada uno tiene una `clave`
 * estable y exacta: es lo que se usa para silenciar una diferencia concreta de
 * forma explicita, nunca con comodines.
 */
export interface Hallazgo {
  /** Identificador exacto, del tipo `esquema:SocioOut.prop:rol.enum`. */
  clave: string;
  /** Ubicacion legible, del tipo `SocioOut.rol`. */
  ruta: string;
  /** Codigo corto: schema-falta, prop-falta, enum-distinto, 404-falta, etc. */
  tipo: string;
  detalle: string;
}

/** Una diferencia que se acepta a proposito, con su motivo escrito. */
export interface Permitida {
  clave: string;
  motivo: string;
}

/**
 * Diferencias que el contrato acepta y el codigo expresa distinto, pero que NO
 * son un error. Cada una esta justificada con la regla del contrato que la
 * manda; si alguna no se puede justificar asi, no va aca: se arregla.
 */
export const PERMITIDAS: Permitida[] = [
  {
    clave: 'esquema-falta:Rol',
    motivo:
      'El contrato declara el enum Rol como schema con nombre, en components.schemas. ' +
      'El codigo lo emite inline en el punto de uso, asi que el documento del backend no ' +
      'materializa ese schema. El resolver ya normaliza los valores al comparar.',
  },
  {
    clave: 'esquema-falta:Plan',
    motivo: 'Mismo caso que Rol: enum con nombre en el contrato, inline en el codigo.',
  },
  {
    clave: 'esquema-falta:EstadoMembresia',
    motivo: 'Mismo caso que Rol: enum con nombre en el contrato, inline en el codigo.',
  },
  {
    clave: 'esquema-falta:EstadoEspera',
    motivo: 'Mismo caso que Rol: enum con nombre en el contrato, inline en el codigo.',
  },
  {
    clave: 'esquema-falta:EstadoReservaClase',
    motivo: 'Mismo caso que Rol: enum con nombre en el contrato, inline en el codigo.',
  },
  {
    clave: 'esquema-falta:EstadoReserva',
    motivo: 'Mismo caso que Rol: enum con nombre en el contrato, inline en el codigo.',
  },
  {
    clave: 'esquema:ReservaCanchaIn.requeridas',
    motivo:
      'El contrato deja usuario_id opcional y dice "Si se omite, se toma del token en la ' +
      'Unidad III". En esta unidad no hay autenticacion todavia, asi que el codigo lo exige ' +
      '(decision 13 del plan M4). Cuando exista el token, el required del contrato se ' +
      'respeta tal cual y esta excepcion se borra.',
  },
  {
    clave: 'body.application/json.requeridas',
    motivo:
      'Mismo caso que esquema:ReservaCanchaIn.requeridas: el body de POST /reservas-canchas ' +
      'exige usuario_id porque todavia no hay token del que derivarlo.',
  },
  {
    clave: 'esquema:UsuarioIn.prop:rol.enum',
    motivo:
      'El enum Rol del contrato tiene 4 valores (SOCIO, EXTERNO, RECEPCION, GERENTE) pero ' +
      'UsuarioIn.rol acepta solo 3. Es intencional y esta escrito en el contrato: ' +
      '"SOCIO no aplica aca: solo por POST /socios". El alta con rol SOCIO se rechaza con 422.',
  },
  {
    clave: 'esquema-falta:TipoCancha',
    motivo: 'Mismo caso que Rol: enum con nombre en el contrato, inline en el codigo.',
  },
  {
    clave: 'esquema-falta:EstadoCancha',
    motivo: 'Mismo caso que Rol: enum con nombre en el contrato, inline en el codigo.',
  },
];

// Campos escalares de un schema que se comparan uno por uno. `description`,
// `example`, `title` y `deprecated` NO estan, a proposito: el contrato redacta en
// prosa larga y el codigo en una linea, asi que compararlos daria decenas de
// falsos positivos sin encontrar un solo error real.
const ESCALARES: Array<[clave: keyof EsquemaCanonico, etiqueta: string]> = [
  ['tipo', 'type'],
  ['formato', 'format'],
  ['anulable', 'nullable'],
  ['minLength', 'minLength'],
  ['maxLength', 'maxLength'],
  ['pattern', 'pattern'],
  ['minimum', 'minimum'],
  ['maximum', 'maximum'],
  ['writeOnly', 'writeOnly'],
  ['default', 'default'],
  ['additionalProperties', 'additionalProperties'],
];

function comoTexto(valor: unknown): string {
  if (valor === undefined) return '(ausente)';
  return JSON.stringify(valor);
}

function conjuntosDistintos(a: string[] | undefined, b: string[] | undefined): string[] {
  const izquierda = new Set(a ?? []);
  const derecha = new Set(b ?? []);
  const soloIzquierda = [...izquierda].filter((v) => !derecha.has(v)).sort();
  const soloDerecha = [...derecha].filter((v) => !izquierda.has(v)).sort();
  return [...soloIzquierda.map((v) => `- ${v}`), ...soloDerecha.map((v) => `+ ${v}`)];
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export function compararEsquemas(
  esperado: EsquemaCanonico,
  obtenido: EsquemaCanonico,
  prefijo: string,
  ruta: string,
  salida: Hallazgo[],
): void {
  // Un $ref roto es siempre un hallazgo, en cualquier lado.
  if (esperado.noResuelto !== undefined) {
    salida.push({
      clave: `${prefijo}.noResuelto`,
      ruta,
      tipo: 'ref-rota',
      detalle: `El contrato apunta a ${esperado.noResuelto} y ese schema no existe en el documento del codigo.`,
    });
    return;
  }
  if (obtenido.noResuelto !== undefined) {
    salida.push({
      clave: `${prefijo}.noResuelto`,
      ruta,
      tipo: 'ref-rota',
      detalle: `El codigo apunta a ${obtenido.noResuelto} y ese schema no existe en el documento del contrato.`,
    });
    return;
  }
  // Un ciclo se corta: comparar mas alla no tiene sentido porque ninguna de las
  // dos partes tiene la forma final.
  if (esperado.ciclo !== undefined || obtenido.ciclo !== undefined) return;

  for (const [campo, etiqueta] of ESCALARES) {
    const a = esperado[campo];
    const b = obtenido[campo];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    salida.push({
      clave: `${prefijo}.${campo}`,
      ruta,
      tipo: 'campo-distinto',
      detalle: `${etiqueta}: contrato ${comoTexto(a)} vs codigo ${comoTexto(b)}.`,
    });
  }

  const diferenciasEnum = conjuntosDistintos(esperado.enum, obtenido.enum);
  if (diferenciasEnum.length > 0) {
    salida.push({
      clave: `${prefijo}.enum`,
      ruta,
      tipo: 'enum-distinto',
      detalle: `enum: contrato [${(esperado.enum ?? []).join(', ')}] vs codigo [${(obtenido.enum ?? []).join(', ')}]. ${diferenciasEnum.join(' ')}`,
    });
  }

  const diferenciasRequeridas = conjuntosDistintos(esperado.requeridas, obtenido.requeridas);
  if (diferenciasRequeridas.length > 0) {
    salida.push({
      clave: `${prefijo}.requeridas`,
      ruta,
      tipo: 'required-distinto',
      detalle: `required: contrato [${(esperado.requeridas ?? []).join(', ')}] vs codigo [${(obtenido.requeridas ?? []).join(', ')}]. ${diferenciasRequeridas.join(' ')}`,
    });
  }

  // El conjunto de propiedades se compara como conjunto: el orden en que aparecen
  // las claves de un objeto JSON no es normativo en OpenAPI, asi que reportarlo
  // seria ruido.
  const propsEsperadas = Object.keys(esperado.propiedades ?? {});
  const propsObtenidas = Object.keys(obtenido.propiedades ?? {});
  for (const nombre of propsEsperadas.filter((p) => !propsObtenidas.includes(p)).sort()) {
    salida.push({
      clave: `${prefijo}.prop-falta:${nombre}`,
      ruta: `${ruta}.${nombre}`,
      tipo: 'prop-falta',
      detalle: `El contrato declara la propiedad "${nombre}" y el codigo no la expone.`,
    });
  }
  for (const nombre of propsObtenidas.filter((p) => !propsEsperadas.includes(p)).sort()) {
    salida.push({
      clave: `${prefijo}.prop-sobra:${nombre}`,
      ruta: `${ruta}.${nombre}`,
      tipo: 'prop-sobra',
      detalle: `El codigo expone la propiedad "${nombre}" y el contrato no la declara.`,
    });
  }
  for (const nombre of propsEsperadas.filter((p) => propsObtenidas.includes(p)).sort()) {
    compararEsquemas(
      esperado.propiedades?.[nombre] ?? {},
      obtenido.propiedades?.[nombre] ?? {},
      `${prefijo}.prop:${nombre}`,
      `${ruta}.${nombre}`,
      salida,
    );
  }

  if ((esperado.oneOf?.length ?? 0) !== (obtenido.oneOf?.length ?? 0)) {
    salida.push({
      clave: `${prefijo}.oneOf`,
      ruta,
      tipo: 'campo-distinto',
      detalle: `oneOf: contrato ${esperado.oneOf?.length ?? 0} alternativa(s) vs codigo ${obtenido.oneOf?.length ?? 0}.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Parametros
// ---------------------------------------------------------------------------

function compararParametros(
  esperados: ParametroCanonico[],
  obtenidos: ParametroCanonico[],
  ruta: string,
  salida: Hallazgo[],
): void {
  const clave = (p: ParametroCanonico) => `${p.in}:${p.name}`;

  for (const p of esperados.filter((p) => !obtenidos.some((o) => clave(o) === clave(p)))) {
    salida.push({
      clave: `param-falta:${ruta}:${clave(p)}`,
      ruta,
      tipo: 'param-falta',
      detalle: `El contrato declara el parametro ${p.name} (${p.in}) y el codigo no.`,
    });
  }
  for (const p of obtenidos.filter((p) => !esperados.some((o) => clave(o) === clave(p)))) {
    salida.push({
      clave: 'param-sobra',
      ruta,
      tipo: 'param-sobra',
      detalle: `El codigo declara el parametro ${p.name} (${p.in}) y el contrato no.`,
    });
  }
  for (const esperado of esperados) {
    const obtenido = obtenidos.find((o) => clave(o) === clave(esperado));
    if (!obtenido) continue;
    if (esperado.required !== obtenido.required) {
      salida.push({
        clave: `param-required:${ruta}:${clave(esperado)}`,
        ruta,
        tipo: 'campo-distinto',
        detalle: `${esperado.name} (${esperado.in}) required: contrato ${esperado.required} vs codigo ${obtenido.required}.`,
      });
    }
    compararEsquemas(
      esperado.esquema,
      obtenido.esquema,
      `param:${clave(esperado)}.esquema`,
      `${ruta}?${esperado.name}`,
      salida,
    );
  }
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

function compararRespuestas(
  esperado: OperacionCanonica,
  obtenido: OperacionCanonica,
  ruta: string,
  salida: Hallazgo[],
): void {
  const codigosEsperados = Object.keys(esperado.respuestas).sort();
  const codigosObtenidos = Object.keys(obtenido.respuestas).sort();

  for (const codigo of codigosEsperados.filter((c) => !codigosObtenidos.includes(c))) {
    salida.push({
      clave: `resp-falta:${ruta}:${codigo}`,
      ruta,
      tipo: 'resp-falta',
      detalle: `El contrato declara la respuesta ${codigo} y el codigo no la expone.`,
    });
  }
  for (const codigo of codigosObtenidos.filter((c) => !codigosEsperados.includes(c))) {
    salida.push({
      clave: `resp-sobra:${ruta}:${codigo}`,
      ruta,
      tipo: 'resp-sobra',
      detalle: `El codigo expone la respuesta ${codigo} y el contrato no la declara.`,
    });
  }

  for (const codigo of codigosEsperados.filter((c) => codigosObtenidos.includes(c))) {
    const a = esperado.respuestas[codigo]?.contenido ?? {};
    const b = obtenido.respuestas[codigo]?.contenido ?? {};
    const mediasEsperadas = Object.keys(a).sort();
    const mediasObtenidas = Object.keys(b).sort();

    for (const media of mediasEsperadas.filter((m) => !mediasObtenidas.includes(m))) {
      salida.push({
        clave: `media-falta:${ruta}:${codigo}:${media}`,
        ruta,
        tipo: 'media-falta',
        detalle: `La respuesta ${codigo} del contrato usa "${media}" y el codigo no.`,
      });
    }
    for (const media of mediasObtenidas.filter((m) => !mediasEsperadas.includes(m))) {
      salida.push({
        clave: `media-sobra:${ruta}:${codigo}:${media}`,
        ruta,
        tipo: 'media-sobra',
        detalle: `La respuesta ${codigo} del codigo usa "${media}" y el contrato no.`,
      });
    }
    for (const media of mediasEsperadas.filter((m) => mediasObtenidas.includes(m))) {
      compararEsquemas(
        a[media],
        b[media],
        `resp:${codigo}.${media}`,
        // `ruta` queda siempre en la clave de operacion y la ubicacion precisa
        // viaja en el prefijo de `clave`. Si se contaminara `ruta` con el
        // codigo de estado, un mismo hallazgo aparecia con dos `ruta` distintas
        // y el agrupado por modulo y la allowlist se rompian.
        ruta,
        salida,
      );
    }
  }
}

function compararOperacion(
  esperado: OperacionCanonica,
  obtenido: OperacionCanonica,
  ruta: string,
  salida: Hallazgo[],
): void {
  if (esperado.operationId !== obtenido.operationId) {
    salida.push({
      clave: `operationId:${ruta}`,
      ruta,
      tipo: 'campo-distinto',
      detalle: `operationId: contrato "${esperado.operationId}" vs codigo "${obtenido.operationId}".`,
    });
  }
  if (esperado.summary !== obtenido.summary) {
    salida.push({
      clave: `summary:${ruta}`,
      ruta,
      tipo: 'campo-distinto',
      detalle: `summary: contrato "${esperado.summary}" vs codigo "${obtenido.summary}".`,
    });
  }
  const diferenciasTags = conjuntosDistintos(esperado.tags, obtenido.tags);
  if (diferenciasTags.length > 0) {
    salida.push({
      clave: `tags:${ruta}`,
      ruta,
      tipo: 'campo-distinto',
      detalle: `tags: contrato [${esperado.tags.join(', ')}] vs codigo [${obtenido.tags.join(', ')}]. ${diferenciasTags.join(' ')}`,
    });
  }

  compararParametros(esperado.parametros, obtenido.parametros, ruta, salida);

  const cuerpoEsperado = esperado.requestBody;
  const cuerpoObtenido = obtenido.requestBody;
  if ((cuerpoEsperado === undefined) !== (cuerpoObtenido === undefined)) {
    salida.push({
      clave: `body-presencia:${ruta}`,
      ruta,
      tipo: 'body-presencia',
      detalle: cuerpoEsperado
        ? 'El contrato define un requestBody y el codigo no expone ninguno.'
        : 'El codigo acepta un requestBody que el contrato no define.',
    });
  } else if (cuerpoEsperado && cuerpoObtenido) {
    if (cuerpoEsperado.required !== cuerpoObtenido.required) {
      salida.push({
        clave: `body-required:${ruta}`,
        ruta,
        tipo: 'campo-distinto',
        detalle: `requestBody required: contrato ${cuerpoEsperado.required} vs codigo ${cuerpoObtenido.required}.`,
      });
    }
    const mediasEsperadas = Object.keys(cuerpoEsperado.contenido).sort();
    const mediasObtenidas = Object.keys(cuerpoObtenido.contenido).sort();
    for (const media of mediasEsperadas.filter((m) => !mediasObtenidas.includes(m))) {
      salida.push({
        clave: `body-media-falta:${ruta}:${media}`,
        ruta,
        tipo: 'media-falta',
        detalle: `El requestBody del contrato usa "${media}" y el codigo no.`,
      });
    }
    for (const media of mediasObtenidas.filter((m) => !mediasEsperadas.includes(m))) {
      salida.push({
        clave: `body-media-sobra:${ruta}:${media}`,
        ruta,
        tipo: 'media-sobra',
        detalle: `El requestBody del codigo usa "${media}" y el contrato no.`,
      });
    }
    for (const media of mediasEsperadas.filter((m) => mediasObtenidas.includes(m))) {
      compararEsquemas(
        cuerpoEsperado.contenido[media],
        cuerpoObtenido.contenido[media],
        `body.${media}`,
        `${ruta} (body)`,
        salida,
      );
    }
  }

  compararRespuestas(esperado, obtenido, ruta, salida);
}

// ---------------------------------------------------------------------------
// Documento entero
// ---------------------------------------------------------------------------

/**
 * Subconjunto del contrato que se compara. Lo calcula alcance.ts a partir de los
 * propios documentos. Si no se pasa, se compara todo.
 */
export interface FiltroAlcance {
  operaciones: string[];
  esquemas: string[];
}

export function compararDocumentos(
  contrato: DocumentoCanonico,
  codigo: DocumentoCanonico,
  filtro?: FiltroAlcance,
): Hallazgo[] {
  const salida: Hallazgo[] = [];

  // Schemas
  const nombresEsperados = (filtro ? filtro.esquemas : Object.keys(contrato.esquemas)).sort();
  const nombresObtenidos = (filtro ? filtro.esquemas : Object.keys(codigo.esquemas)).sort();
  for (const nombre of nombresEsperados) {
    if (!(nombre in codigo.esquemas)) {
      salida.push({
        clave: `esquema-falta:${nombre}`,
        ruta: nombre,
        tipo: 'schema-falta',
        detalle: `El contrato define el schema ${nombre} y el documento del codigo no lo tiene.`,
      });
      continue;
    }
    compararEsquemas(
      contrato.esquemas[nombre],
      codigo.esquemas[nombre],
      `esquema:${nombre}`,
      nombre,
      salida,
    );
  }
  for (const nombre of nombresObtenidos.filter((n) => !(n in contrato.esquemas))) {
    salida.push({
      clave: `esquema-sobra:${nombre}`,
      ruta: nombre,
      tipo: 'schema-sobra',
      detalle: `El codigo define el schema ${nombre} y el contrato no lo tiene.`,
    });
  }

  // Operaciones
  const clavesEsperadas = (filtro ? filtro.operaciones : Object.keys(contrato.operaciones)).sort();
  const clavesObtenidas = (filtro ? filtro.operaciones : Object.keys(codigo.operaciones)).sort();
  for (const clave of clavesEsperadas) {
    const obtenido = codigo.operaciones[clave];
    if (!obtenido) {
      salida.push({
        clave: `op-falta:${clave}`,
        ruta: clave,
        tipo: 'op-falta',
        detalle: `El contrato define la operacion ${clave} y el codigo no la expone.`,
      });
      continue;
    }
    const esperado = contrato.operaciones[clave];
    if (esperado) compararOperacion(esperado, obtenido, clave, salida);
  }
  for (const clave of clavesObtenidas.filter((c) => !(c in contrato.operaciones))) {
    salida.push({
      clave: `op-sobra:${clave}`,
      ruta: clave,
      tipo: 'op-sobra',
      detalle: `El codigo expone la operacion ${clave} y el contrato no la define.`,
    });
  }

  return salida;
}

/** Saca de la lista los hallazgos que estan justificados en permitidas.ts. */
export function aplicarPermitidas(
  hallazgos: Hallazgo[],
  permitidas: Permitida[] = PERMITIDAS,
): { efectivos: Hallazgo[]; silenciados: Array<Hallazgo & { motivo: string }> } {
  const motivos = new Map(permitidas.map((p) => [p.clave, p.motivo]));
  const efectivos: Hallazgo[] = [];
  const silenciados: Array<Hallazgo & { motivo: string }> = [];

  for (const hallazgo of hallazgos) {
    const motivo = motivos.get(hallazgo.clave);
    if (motivo === undefined) {
      efectivos.push(hallazgo);
    } else {
      silenciados.push({ ...hallazgo, motivo });
    }
  }

  return { efectivos, silenciados };
}
