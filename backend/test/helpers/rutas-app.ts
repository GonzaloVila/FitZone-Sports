import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/commons/guards/public.decorator';

export type MetodoHttp = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RutaDeLaApp {
  metodo: MetodoHttp;
  // Ruta completa con el prefijo global y los parametros en formato Nest (/api/v1/ingresos/:ingresoId).
  ruta: string;
  publica: boolean;
}

const METODOS: Partial<Record<RequestMethod, MetodoHttp>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

const PREFIJO = '/api/v1';

function unir(...partes: string[]): string {
  const ruta = partes
    .join('/')
    .split('/')
    .filter((parte) => parte !== '')
    .join('/');
  return `/${ruta}`;
}

function primerPath(valor: unknown): string {
  return Array.isArray(valor) ? String(valor[0] ?? '') : String(valor ?? '');
}

// Recorre los controllers registrados en la app (DiscoveryService) y arma, por cada handler HTTP, su metodo, su ruta real y si
// esta marcado @Public() (en el handler o en la clase, igual que lo resuelve JwtAuthGuard). No depende del contrato.
export function listarRutasDeLaApp(app: INestApplication): RutaDeLaApp[] {
  const reflector = app.get(Reflector);
  const rutas: RutaDeLaApp[] = [];

  for (const wrapper of app.get(DiscoveryService).getControllers()) {
    const clase = wrapper.metatype;
    if (!clase) continue;
    const base = primerPath(Reflect.getMetadata(PATH_METADATA, clase));

    for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
      const handler = (clase.prototype as Record<string, unknown>)[nombre];
      if (typeof handler !== 'function' || nombre === 'constructor') continue;
      const metodo = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (metodo === undefined) continue;

      const verbo = METODOS[metodo];
      if (!verbo) throw new Error(`Metodo HTTP sin soporte en el recorrido de rutas: ${clase.name}.${nombre}`);
      const propia = primerPath(Reflect.getMetadata(PATH_METADATA, handler));
      rutas.push({
        metodo: verbo,
        ruta: unir(PREFIJO, base, propia),
        publica: reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [handler as () => void, clase]) === true,
      });
    }
  }

  return rutas;
}

// /api/v1/ingresos/:ingresoId -> /api/v1/ingresos/1
export function conParametrosDeEjemplo(ruta: string): string {
  return ruta.replace(/:[A-Za-z]\w*/g, '1');
}

export const etiqueta = (r: Pick<RutaDeLaApp, 'metodo' | 'ruta'>): string => `${r.metodo.toUpperCase()} ${r.ruta}`;
