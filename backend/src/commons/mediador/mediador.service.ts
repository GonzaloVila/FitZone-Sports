import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  PROCESAR_PAGO_PORT,
  type ComprobanteDto,
  type ProcesarPagoPort,
  type SolicitudCobro,
} from "./procesar-pago.port";

@Injectable()
export class MediadorService {
  constructor(
    @Optional() @Inject(PROCESAR_PAGO_PORT)
    private readonly procesarPago: ProcesarPagoPort | null,
  ) {}

  solicitarCobro(solicitud: SolicitudCobro): Promise<ComprobanteDto> {
    if (!this.procesarPago) {
      return Promise.reject(
        new Error(
          "M5 (Pagos) aun no registra ProcesarPagoPort: el cobro no puede procesarse",
        ),
      );
    }
    return this.procesarPago.ejecutar(solicitud);
  }
}