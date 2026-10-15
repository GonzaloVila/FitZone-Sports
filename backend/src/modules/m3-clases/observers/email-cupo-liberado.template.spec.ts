import { describe, expect, it } from 'vitest';
import {
  NOMBRE_MARCA,
  asuntoCupoLiberado,
  cuerpoHtml,
  cuerpoTexto,
} from 'src/modules/m3-clases/observers/email-cupo-liberado.template';

const evento = {
  claseId: 42,
  nombreClase: 'TRX Intensivo',
  horarioClase: '2026-10-01T19:30:00-03:00',
  socioIdCancelador: 7,
  fechaLiberacion: new Date('2026-10-01T12:00:00-03:00'),
};

describe('plantilla email cupo liberado (branding FitZone)', () => {
  it('el asunto lleva la marca, el nombre de la clase y el horario legible (hora de la sede)', () => {
    const asunto = asuntoCupoLiberado(evento);
    expect(asunto).toContain(NOMBRE_MARCA);
    expect(asunto).toContain('Se liberó un cupo');
    expect(asunto).toContain('TRX Intensivo');
    expect(asunto).toContain('01/10/2026');
    expect(asunto).toContain('19:30');
    // Ya no se muestra el ISO crudo.
    expect(asunto).not.toContain('T22:30');
  });

  it('omite el horario del asunto si la fecha es inválida', () => {
    const asunto = asuntoCupoLiberado({ ...evento, horarioClase: 'no-es-fecha' });
    expect(asunto).not.toContain('(');
  });

  it('el HTML trae la marca, el nombre de la clase, el pie de no-responder y no dice "first-come"', () => {
    const html = cuerpoHtml(evento);
    expect(html).toMatch(/<!DOCTYPE html>/);
    expect(html).toContain(NOMBRE_MARCA);
    expect(html).toContain('TRX Intensivo');
    expect(html).toContain('no responder');
    expect(html).not.toContain('first-come');
  });

  it('el texto plano de respaldo trae la marca, el nombre de la clase y no dice "first-come"', () => {
    const texto = cuerpoTexto(evento);
    expect(texto).toContain('TRX Intensivo');
    expect(texto).toContain(NOMBRE_MARCA);
    expect(texto).not.toContain('first-come');
  });

  it('si el evento no trae nombre de clase, cae al id', () => {
    const sinNombre = { ...evento, nombreClase: '   ' };
    expect(asuntoCupoLiberado(sinNombre)).toContain(`#${evento.claseId}`);
    expect(cuerpoHtml(sinNombre)).toContain(`#${evento.claseId}`);
    expect(cuerpoTexto(sinNombre)).toContain(`#${evento.claseId}`);
  });

  it('sin horario válido, el HTML no incluye la fila de horario', () => {
    const html = cuerpoHtml({ ...evento, horarioClase: 'no-es-fecha' });
    expect(html).not.toContain('Horario:');
  });
});
