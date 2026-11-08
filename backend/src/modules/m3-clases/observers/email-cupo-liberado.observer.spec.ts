import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SociosService } from '../../m1-usuarios/services/socios.service';
import type { EsperaClaseRepository } from '../repositories/espera-clase.repository';
import type { CupoLiberadoEvent } from './cupo-liberado.event';
import { EmailCupoLiberadoObserver } from './email-cupo-liberado.observer';

// RF-08, segundo oyente del cupo liberado: manda un mail a cada socio de la cola. nodemailer va mockeado, asi que el
// test nunca sale a la red.
const nodemailer = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'id' });
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail })),
    createTestAccount: vi.fn().mockResolvedValue({
      user: 'prueba@ethereal.email',
      pass: 'x',
      smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
    }),
    getTestMessageUrl: vi.fn().mockReturnValue('https://ethereal.email/message/abc'),
  };
});
vi.mock('nodemailer', () => nodemailer);

const EVENTO: CupoLiberadoEvent = {
  claseId: 30,
  nombreClase: 'Spinning',
  horarioClase: '2026-11-10T21:00:00.000Z',
  socioIdCancelador: 7,
  fechaLiberacion: new Date('2026-11-09T15:00:00Z'),
};

const EMAILS: Record<number, string | null> = { 1: 'ana@fitzone.test', 2: null, 3: 'carlos@fitzone.test' };

function armar(socioIds: number[]) {
  const esperas = { listarSociosEnEsperaPorClase: vi.fn().mockResolvedValue(socioIds) };
  const socios = { obtenerEmail: vi.fn(async (id: number) => EMAILS[id] ?? null) };
  const observer = new EmailCupoLiberadoObserver(
    esperas as unknown as EsperaClaseRepository,
    socios as unknown as SociosService,
  );
  return { observer, esperas, socios };
}

describe('EmailCupoLiberadoObserver (RF-08)', () => {
  let log: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const clave of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'SMTP_SECURE', 'MAIL_FROM', 'ETHEREAL']) {
      vi.stubEnv(clave, undefined);
    }
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('con SMTP configurado', () => {
    beforeEach(() => {
      vi.stubEnv('SMTP_HOST', 'smtp.fitzone.test');
      vi.stubEnv('SMTP_USER', 'avisos@fitzone.test');
      vi.stubEnv('SMTP_PASS', 'secreto');
      vi.stubEnv('SMTP_PORT', '465');
      vi.stubEnv('SMTP_SECURE', 'true');
      vi.stubEnv('MAIL_FROM', 'FitZone <no-responder@fitzone.test>');
    });

    it('arma el transporte con la configuracion del entorno', async () => {
      await armar([1]).observer.notificarCupoDisponible(EVENTO);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.fitzone.test',
        port: 465,
        secure: true,
        auth: { user: 'avisos@fitzone.test', pass: 'secreto' },
      });
    });

    it('manda un mail por socio con email, con asunto, texto y html de la plantilla', async () => {
      await armar([1, 3]).observer.notificarCupoDisponible(EVENTO);

      expect(nodemailer.sendMail).toHaveBeenCalledTimes(2);
      expect(nodemailer.sendMail.mock.calls.map(([mail]) => mail.to)).toEqual(['ana@fitzone.test', 'carlos@fitzone.test']);
      const [mail] = nodemailer.sendMail.mock.calls[0];
      expect(mail).toMatchObject({ from: 'FitZone <no-responder@fitzone.test>', subject: expect.any(String) });
      expect(mail.subject.length).toBeGreaterThan(0);
      expect(mail.text).toContain('Spinning');
      expect(mail.html).toContain('<');
    });

    it('omite a quien no tiene email y lo informa', async () => {
      await armar([1, 2, 3]).observer.notificarCupoDisponible(EVENTO);

      expect(nodemailer.sendMail).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith('El socio 2 no tiene email cargado: se omite su aviso.');
      expect(log).toHaveBeenCalledWith('Avisos de la clase 30: 2 enviados de 3 socios en cola, 1 sin email.');
    });

    it('resuelve el transporte una sola vez por proceso', async () => {
      const { observer } = armar([1]);

      await observer.notificarCupoDisponible(EVENTO);
      await observer.notificarCupoDisponible(EVENTO);

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(nodemailer.sendMail).toHaveBeenCalledTimes(2);
    });

    it('un error de envio se loguea y no rompe la cancelacion que disparo el evento', async () => {
      nodemailer.sendMail.mockRejectedValueOnce(new Error('SMTP caido'));

      await expect(armar([1]).observer.notificarCupoDisponible(EVENTO)).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(expect.stringContaining('SMTP caido'));
    });
  });

  it('con ETHEREAL=true usa una cuenta de prueba y loguea la vista previa', async () => {
    vi.stubEnv('ETHEREAL', 'true');

    await armar([1]).observer.notificarCupoDisponible(EVENTO);

    expect(nodemailer.createTestAccount).toHaveBeenCalledTimes(1);
    expect(nodemailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'prueba@ethereal.email' }));
    expect(log).toHaveBeenCalledWith('Vista previa del aviso para el socio 1: https://ethereal.email/message/abc');
  });

  it('sin configuracion de mail no sale a la red: solo loguea', async () => {
    await armar([1, 3]).observer.notificarCupoDisponible(EVENTO);

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(nodemailer.sendMail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Avisos de la clase 30: 0 enviados de 2 socios en cola.');
  });

  it('sin nadie en la cola no resuelve transporte ni pide emails', async () => {
    const { observer, socios } = armar([]);

    await observer.notificarCupoDisponible(EVENTO);

    expect(socios.obtenerEmail).not.toHaveBeenCalled();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});
