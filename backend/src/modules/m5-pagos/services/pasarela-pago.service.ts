import { Injectable } from '@nestjs/common';

/**
 * Decisión 3 del plan: el rechazo de la pasarela es un RESULTADO de negocio, no
 * una excepción. Un `throw` obligaría a cada llamador a distinguir "la pasarela
 * explotó" de "la pasarela dijo que no", y el que explota es el error de sistema
 * (500); el otro es un 402 que hay que persistir como `RECHAZADO` y después poder
 * listar. Por eso el resultado es un tipo y nunca un `throw`.
 */
export type ResultadoPasarela =
  | { estado: 'APROBADO'; pasarelaToken: string }
  | { estado: 'PENDIENTE'; pasarelaToken: string }
  | { estado: 'RECHAZADO'; motivo: string };

export type ResultadoReembolso =
  | { ok: true }
  | { ok: false; motivo: string };

export interface SolicitudPasarela {
  token: string;
  monto: number;
  moneda: string;
  idempotenciaKey: string;
}

/**
 * Implementación SIMULADA de la pasarela (alcance académico: el caso pide un mock).
 *
 * Es determinista a propósito: el e2e tiene que ser hermético y repetible, así que
 * el resultado depende SOLO del token y no de un reloj, un número aleatorio ni de
 * una salida a la red. La regla, explícita y legible desde el test:
 *
 *   - `tok_aprobado...`  → APROBADO
 *   - `tok_pendiente...` → PENDIENTE
 *   - cualquier otro      → RECHAZADO
 *
 * `tok_pendiente` existe para poder ejercitar el estado PENDIENTE de la decisión 7
 * sin reloj ni esperas: un pago asíncrono real no se modela (el contrato no
 * declara 202), pero el estado está en el enum y el listado lo tiene que saber
 * filtrar.
 */
const PREFIJO_APROBADO = 'tok_aprobado';
const PREFIJO_PENDIENTE = 'tok_pendiente';

/**
 * FRONTERA (decisión 9 del plan). `PagosService` llama a `cobrar()` y no sabe con
 * qué frontera está trabajando: cambiar la implementación interna de esta clase
 * (MercadoPago, Modo, otro) no lo toca.
 *
 * Sobre la selección por `NODE_ENV` que pide la decisión 9: la rama existe cuando
 * haya un segundo proveedor. Hoy hay uno solo, así que elegir por entorno sería
 * escribir un `switch` cuyas dos ramas dan lo mismo, que es peor que no tenerlo.
 * Cuando aparezca el proveedor real, la selección va en el constructor de esta
 * clase y `PagosService` sigue sin enterarse; la frontera ya está en el lugar que
 * el plan pide, que es lo único que la decisión protege.
 *
 * `solicitarPago` contra una pasarela real devuelve el token del proveedor para
 * guardarlo (RNF-02: el token de la pasarela sí se guarda, la tarjeta no), y por
 * eso el resultado aprobado lleva `pasarela_token` y no solo un booleano.
 */
@Injectable()
export class PasarelaPagoService {
  async cobrar(solicitud: SolicitudPasarela): Promise<ResultadoPasarela> {
    const { token, idempotenciaKey } = solicitud;

    if (token.startsWith(PREFIJO_APROBADO)) {
      // El token que se persiste es el de la pasarela, no el que mandó el cliente.
      // Con el mock son el mismo string; con un proveedor real serían distintos y
      // esta línea es la que habría que cambiar.
      return { estado: 'APROBADO', pasarelaToken: token };
    }

    if (token.startsWith(PREFIJO_PENDIENTE)) {
      return { estado: 'PENDIENTE', pasarelaToken: token };
    }

    return {
      estado: 'RECHAZADO',
      motivo: 'La pasarela rechazó el token (fondos insuficientes o token inválido).',
    };
  }

  /**
   * La devolución, para la anulación de un pago que SÍ se cobró. Mismo criterio
   * que `cobrar`: el rechazo es un resultado, no una excepción. Y como en el mock
   * no hay contracargo, el resultado es siempre exitoso: el caso de negocio real
   * (pago aprobado que no se puede devolver) no tiene todavía con qué probarse, y
   *falsearlo acá sería inventar comportamiento que el alcance no pide.
   */
  async reembolsar(pago: {
    token: string;
    monto: number;
    moneda: string;
    idempotenciaKey: string;
  }): Promise<ResultadoReembolso> {
    void pago;
    return { ok: true };
  }
}