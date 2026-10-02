/**
 * Que partes del contrato se comparan y cuales todavia no existen en el codigo.
 *
 * El contrato declara 46 operaciones y el backend expone menos: la diferencia son
 * los modulos que todavia no estan implementados, o bloques de un modulo que si.
 * Eso NO es una desalineacion y no puede reportarse como una, porque seria una
 * diferencia que nadie va a poder arreglar nunca y dejaria la herramienta siempre
 * en rojo.
 *
 * El limite se saca de los propios documentos, sin hardcodear modulos: una
 * operacion se compara si el codigo la expone, es decir si declara ese metodo en
 * esa ruta. Los schemas se derivan despues, siguiendo los $ref desde las
 * operaciones implementadas, para no exigir schemas que solo usan lo que falta.
 *
 * POR QUE NO ALCANZA CON COMPARTIR TAG. Antes el criterio era "comparte al menos
 * un tag con el codigo", y era una aproximacion que solo servia mientras cada
 * modulo venia completo. En cuanto M4 publico 4 de sus 5 endpoints, el tag
 * `canchas` quedo implementado y el comparador empezo a exigir tambien
 * `GET /canchas/{cancha_id}/disponibilidad`, que es del bloque 3 y todavia no
 * esta escrito: un rojo permanente que no era desalineacion sino trabajo futuro.
 * Con M5 el problema era mayor, porque `reservas-canchas` y `pagos` son tags
 * enteros que todavia no existen.
 *
 * POR QUE SE NORMALIZAN LOS NOMBRES DE LOS PARAMETROS. Al decidir el alcance, los
 * nombres de parametro de la ruta se vuelven `{}`: asi una ruta que difiere solo
 * en el naming (por ejemplo `/canchas/{canchaId}` contra `/canchas/{cancha_id}`)
 * cuenta como expuesta y se reporta, en vez de desaparecer del reporte. Sin
 * esto, un modulo que se olvidara del snake_case se caeria del alcance en verde
 * y nadie lo veria, que es el peor resultado posible para una herramienta cuyo
 * unico trabajo es mostrar lo que falta.
 *
 * El nombre real del parametro no se pierde: sigue viajando en las claves que se
 * comparan, asi que la diferencia se reporta en detalle una vez que el codigo
 * expone la operacion y se puede entrar a comparar metodo, parametros y
 * respuestas.
 */

const PREFIJO_SCHEMAS = '#/components/schemas/';

const METODOS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

export interface Alcance {
  /** Tags que el backend declara en al menos una operacion. */
  modulosImplementados: string[];
  /** Claves "GET /usuarios" de las operaciones a comparar. */
  operaciones: string[];
  /** Nombres de components.schemas que hay que comparar. */
  esquemas: string[];
  /** Operaciones del contrato todavia no implementadas, solo informativo. */
  pendientes: string[];
  /** Schemas del contrato que solo usan operaciones pendientes. */
  esquemasPendientes: string[];
  /** "GET /usuarios" -> tag del contrato. Para agrupar el reporte. */
  moduloDeOperacion: Record<string, string>;
  /** "SocioOut" -> tags que lo usan, para atribuir un hallazgo de schema. */
  modulosDeEsquema: Record<string, string[]>;
}

function comoObjeto(valor: unknown): Record<string, unknown> | undefined {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return undefined;
  return valor as Record<string, unknown>;
}

/** Todos los nombres de schema que un arbol de nodos referencia, en cualquier profundidad. */
function referenciasDeSchemas(nodo: unknown, acumulado: Set<string>, profundidad = 0): void {
  if (profundidad > 40) return;

  if (Array.isArray(nodo)) {
    for (const hijo of nodo) referenciasDeSchemas(hijo, acumulado, profundidad + 1);
    return;
  }

  const objeto = comoObjeto(nodo);
  if (!objeto) return;

  for (const [clave, valor] of Object.entries(objeto)) {
    if (clave === '$ref' && typeof valor === 'string' && valor.startsWith(PREFIJO_SCHEMAS)) {
      acumulado.add(valor.slice(PREFIJO_SCHEMAS.length));
      continue;
    }
    referenciasDeSchemas(valor, acumulado, profundidad + 1);
  }
}

export function calcularAlcance(contrato: unknown, codigo: unknown): Alcance {
  const docContrato = comoObjeto(contrato) ?? {};
  const docCodigo = comoObjeto(codigo) ?? {};

  // 1) Que declara el backend. Se necesitan dos cosas: la union de sus tags, que
  //    despues sirve para atribuir un hallazgo a un modulo, y el conjunto de
  //    operaciones que realmente expone, que es lo que decide el alcance.
  const modulos = new Set<string>();
  for (const pathItem of Object.values(comoObjeto(docCodigo.paths) ?? {})) {
    const item = comoObjeto(pathItem);
    if (!item) continue;
    for (const metodo of METODOS) {
      const op = comoObjeto(item[metodo]);
      for (const tag of Array.isArray(op?.tags) ? op.tags : []) {
        if (typeof tag === 'string') modulos.add(tag);
      }
    }
  }

  const componentes = comoObjeto(docContrato.components);
  const schemasDelContrato = new Set(Object.keys(comoObjeto(componentes?.schemas) ?? {}));

  // 2) Que operaciones del contrato se comparan.
  const operaciones: string[] = [];
  const pendientes: string[] = [];
  const alcanzables = new Set<string>();
  const moduloDeOperacion: Record<string, string> = {};
  const modulosDeEsquema: Record<string, string[]> = {};

  /** Anota que modulo (tag) del contrato usa un schema. */
  const anotarUso = (nombres: Set<string>, tags: string[]): void => {
    for (const nombre of nombres) {
      const previos = modulosDeEsquema[nombre] ?? [];
      modulosDeEsquema[nombre] = [...new Set([...previos, ...tags])];
    }
  };
  const prefijo = (() => {
    // `servers` es una lista, no un objeto: pasarlo por comoObjeto devolveria
    // undefined y el prefijo quedaria vacio. Solo tiene sentido quitarlo ahora
    // que el alcance se decide por rutas; antes el prefijo no se usaba para nada.
    const bruto = docContrato.servers;
    const lista = Array.isArray(bruto)
      ? bruto
      : Object.values(comoObjeto(bruto) ?? {});
    const primero = comoObjeto(lista[0]);
    const url = typeof primero?.url === 'string' ? primero.url : '';
    try {
      return new URL(url).pathname.replace(/\/+$/, '');
    } catch {
      return url.replace(/\/+$/, '');
    }
  })();
  const sinPrefijo = (ruta: string) =>
    prefijo !== '' && ruta.startsWith(`${prefijo}/`) ? ruta.slice(prefijo.length) : ruta;

  /** Clave de alcance: metodo + ruta, con los nombres de parametro anonimos. */
  const claveDeAlcance = (metodo: string, ruta: string) =>
    `${metodo.toUpperCase()} ${ruta.replace(/\{[^}]*\}/g, '{}')}`;

  // 1b) Que operaciones expone el backend de verdad. Se calcula aca, y no junto a
  // los tags, porque necesita el prefijo para comparar rutas en la misma base que
  // el contrato: el documento de NestJS trae las rutas con el prefijo global ya
  // aplicado, y el contrato lo tiene en servers[0].url.
  const expuestasPorElCodigo = new Set<string>();
  for (const [rutaCruda, pathItem] of Object.entries(comoObjeto(docCodigo.paths) ?? {})) {
    const item = comoObjeto(pathItem);
    if (!item) continue;
    const ruta = sinPrefijo(rutaCruda);
    for (const metodo of METODOS) {
      if (item[metodo] === undefined) continue;
      expuestasPorElCodigo.add(claveDeAlcance(metodo, ruta));
    }
  }

  for (const [rutaCruda, pathItem] of Object.entries(comoObjeto(docContrato.paths) ?? {})) {
    const item = comoObjeto(pathItem);
    if (!item) continue;
    const ruta = sinPrefijo(rutaCruda);

    for (const metodo of METODOS) {
      const op = comoObjeto(item[metodo]);
      if (!op) continue;
      const clave = `${metodo.toUpperCase()} ${ruta}`;

      const tags = Array.isArray(op.tags) ? op.tags.filter((t): t is string => typeof t === 'string') : [];
      // Se compara si el codigo expone ese metodo en esa ruta. Comparar por tag
      // no sirve: con un modulo a medio implementar, el tag ya existe y el
      // comparador terminaria exigiendo los endpoints de los bloques que faltan.
      // El nombre del parametro va normalizado para que una diferencia de naming
      // se reporte en detalle y no haga caer la operacion fuera del alcance.
      const implementada = expuestasPorElCodigo.has(claveDeAlcance(metodo, ruta));

      if (!implementada) {
        pendientes.push(clave);
        continue;
      }

      operaciones.push(clave);
      moduloDeOperacion[clave] = tags[0] ?? '(sin tag)';
      // Solo esta operacion y su path item. Recorrer el arbol `paths` entero
      // arrastraria los schemas de M4 y M5, que todavia no existen en el codigo
      // y por lo tanto no se pueden comparar.
      const usadas = new Set<string>();
      referenciasDeSchemas(op, usadas);
      referenciasDeSchemas(item.parameters, usadas);
      for (const nombre of usadas) alcanzables.add(nombre);
      anotarUso(usadas, tags);
    }
  }

  // 3) Cierre transitivo: un schema puede referenciar a otro. Los tags se
  // heredan del schema que lo referencia, asi que un schema anidado queda
  // atribuido al modulo de la operacion que lo usa.
  //
  // La herencia se resuelve con aristas y punto fijo, no propagando durante el
  // recorrido: el recorrido es LIFO y un schema puede descubrirse antes que el
  // padre que lo nombra, asi que una pasada sola dejaba schemas sin modulo
  // segun el orden. Con punto fijo el resultado no depende del orden.
  const esquemas = new Set<string>();
  const aristas: Array<[string, string]> = [];
  const porRevisar = [...alcanzables];
  while (porRevisar.length > 0) {
    const nombre = porRevisar.pop() as string;
    if (esquemas.has(nombre)) continue;
    esquemas.add(nombre);
    const definicion = comoObjeto(comoObjeto(componentes?.schemas)?.[nombre]);
    const nuevas = new Set<string>();
    referenciasDeSchemas(definicion, nuevas);
    for (const nueva of nuevas) {
      aristas.push([nombre, nueva]);
      if (!esquemas.has(nueva)) porRevisar.push(nueva);
    }
  }

  // Punto fijo: se repite hasta que ninguna arista agregue un tag nuevo.
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const [origen, destino] of aristas) {
      const de = modulosDeEsquema[origen] ?? [];
      if (de.length === 0) continue;
      const en = modulosDeEsquema[destino] ?? [];
      const union = new Set([...en, ...de]);
      if (union.size > en.length) {
        modulosDeEsquema[destino] = [...union];
        cambio = true;
      }
    }
  }

  // Problem se compara siempre: es el sobre de todos los errores.
  if (schemasDelContrato.has('Problem')) {
    esquemas.add('Problem');
    modulosDeEsquema.Problem = [...new Set([...(modulosDeEsquema.Problem ?? []), 'todos'])];
  }

  const esquemasPendientes = [...schemasDelContrato]
    .filter((nombre) => !esquemas.has(nombre))
    .sort();

  return {
    modulosImplementados: [...modulos].sort(),
    operaciones: operaciones.sort(),
    esquemas: [...esquemas].sort(),
    pendientes: pendientes.sort(),
    esquemasPendientes,
    moduloDeOperacion,
    modulosDeEsquema,
  };
}
