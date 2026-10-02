import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { SociosService } from '../../m1-usuarios/services/socios.service';
import { EsperaClaseRepository } from '../repositories/espera-clase.repository';
import type { CupoLiberadoEvent } from './cupo-liberado.event';
import type { CupoLiberadoObserver } from './cupo-liberado.observer';

// Canal de aviso del cupo liberado (ADR-05, cadena de observers). Es un observer
// mas: no conoce el dominio de la espera, solo lee la cola viva de la clase, pide
// el email de cada socio a M1 y manda el aviso. Agregar WhatsApp o push es
// agregar otra impl de CupoLiberadoObserver y registrarla en el subject.
//
// Modo de envio, en este orden:
//   1. SMTP_* en env  -> transporte real.
//   2. ETHEREAL=true  -> cuenta de prueba de Ethereal (createTestAccount, una vez
//                        por proceso) y se loguea la URL de vista previa.
//   3. sin configurar -> solo loguea, sin red. Asi el e2e no sale a internet.
@Injectable()
export class EmailCupoLiberadoObserver implements CupoLiberadoObserver {
  private readonly logger = new Logger(EmailCupoLiberadoObserver.name);
  private transporte: Transporter | null = null;
  private remitente = '';
  private ethereal = false;
  private transporteResuelto = false;

  constructor(
    private readonly esperasRepo: EsperaClaseRepository,
    // M1 es quien sabe el email de un socio. Antes venía por
    // `CONSULTA_SOCIO_PORT` con `@Optional()`, y si faltaba el aviso se perdía
    // en silencio; ahora la dependencia es obligatoria y la única causa de no
    // enviar es que el socio no tenga email cargado.
    private readonly socios: SociosService,
  ) {}

  async notificarCupoDisponible(evento: CupoLiberadoEvent): Promise<void> {
    const socioIds = await this.esperasRepo.listarSociosEnEsperaPorClase(evento.claseId);
    if (socioIds.length === 0) {
      this.logger.log(
        `Sin socios en la cola viva de la clase ${evento.claseId}: no hay aviso que enviar.`,
      );
      return;
    }

    await this.resolverTransporte();

    const asunto = `Se liberó un cupo en tu clase${evento.horarioClase ? ` (${formatearHorario(evento.horarioClase)})` : ''}`;
    const cuerpo =
      `Hola,\n\nSe liberó un cupo en la clase ${evento.claseId} y quedó disponible ` +
      `por Confirmación (modalidad first-come, gana el primero que confirme).\n` +
      `Ingresá al sistema para confirmar tu anotación de la lista de espera.\n\n` +
      `Si no confirmás a tiempo, el cupo pasa al siguiente socio en espera.`;

    let enviados = 0;
    let sinDestinatario = 0;
    for (const socioId of socioIds) {
      const email = await this.socios.obtenerEmail(socioId);
      if (!email) {
        sinDestinatario += 1;
        this.logger.warn(`El socio ${socioId} no tiene email cargado: se omite su aviso.`);
        continue;
      }
      if (!this.transporte) {
        continue;
      }
      const info = await this.transporte.sendMail({
        from: this.remitente,
        to: email,
        subject: asunto,
        text: cuerpo,
      });
      enviados += 1;
      if (this.ethereal) {
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) {
          this.logger.log(`Vista previa del aviso para el socio ${socioId}: ${preview}`);
        }
      }
    }

    this.logger.log(
      `Avisos de la clase ${evento.claseId}: ${enviados} enviados de ${socioIds.length} ` +
        `${socioIds.length === 1 ? 'socio' : 'socios'} en cola` +
        (sinDestinatario > 0 ? `, ${sinDestinatario} sin email` : '') +
        '.',
    );
  }

  // El transporte se resuelve una vez por proceso y se reutiliza en todos los avisos.
  private async resolverTransporte(): Promise<void> {
    if (this.transporteResuelto) {
      return;
    }
    this.transporteResuelto = true;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.MAIL_FROM;

    if (host && user && pass) {
      this.transporte = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
      this.remitente = from ?? user;
      this.logger.log(`Avisos de cupo liberado por SMTP (${host}).`);
      return;
    }

    if (process.env.ETHEREAL === 'true') {
      const cuenta = await nodemailer.createTestAccount();
      this.transporte = nodemailer.createTransport({
        host: cuenta.smtp.host,
        port: cuenta.smtp.port,
        secure: cuenta.smtp.secure,
        auth: { user: cuenta.user, pass: cuenta.pass },
      });
      this.remitente = from ?? cuenta.user;
      this.ethereal = true;
      this.logger.log(
        `Avisos de cupo liberado por Ethereal (modo prueba) desde ${this.remitente}.`,
      );
      return;
    }

    this.logger.log(
      'Sin SMTP_* ni ETHEREAL=true: se omiten los avisos por email y solo se loguea el evento.',
    );
  }
}

function formatearHorario(horarioClase: string): string {
  const fecha = new Date(horarioClase);
  if (isNaN(fecha.getTime())) {
    return horarioClase;
  }
  return fecha.toISOString();
}
