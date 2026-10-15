import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM5 } from './m5.fixtures';

// E2E de RF-14: la descarga HTTP del comprobante (content-type, disposition y bytes)
// y el 409 cuando el pago no está APROBADO. La generación/lectura del archivo la cubre
// la integración.
describe('M5 - Comprobante en PDF (RF-14)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM5>>;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM5(app, prisma);
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  function comprobante(pagoId: number) {
    return request(app.getHttpServer()).get(`/api/v1/pagos/${pagoId}/comprobante`);
  }

  it('devuelve el PDF con application/pdf y el nombre de descarga', async () => {
    const reservaId = await ctx.crearReserva(7750);
    const cobrado = await ctx.cobroReserva(reservaId, `pdf-get-${ctx.sufijo}`).expect(201);
    const id = cobrado.body.id as number;

    const res = await comprobante(id).expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(`comprobante-pago-${id}.pdf`);
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('409 y sin archivo si el pago fue rechazado', async () => {
    const reservaId = await ctx.crearReserva();
    const clave = `pdf-rech-${ctx.sufijo}`;

    await ctx.cobroReserva(reservaId, clave, 'tok_basura').expect(402);
    const pago = await prisma.pago.findUnique({ where: { idempotencia_key: clave } });
    const id = pago!.id;

    expect(pago!.comprobante_pdf_url).toBeNull();
    const res = await comprobante(id).expect(409);
    expect(res.body.title).toBe('Pago no aprobado');
    expect(res.body.detail).toContain('RECHAZADO');
  });
});
