import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PagoIn } from './pago-in.dto';

// La traducción de `ConceptoPago` a runtime. El contrato lo modela como `oneOf` con
// `additionalProperties: false` en cada rama, o sea que la rama elegida prohíbe el
// id de la otra. Estos tests fijan las cuatro combinaciones porque el caso que
// rompe en silencio es el del medio: `{tipo: MEMBRESIA, reserva_cancha_id: 7}` pasa
// los decoradores de campo sueltos (ambos ids son enteros válidos) y sin la regla
// del oneOf el service no sabría qué cobrar.
describe('PagoIn', () => {
  /**
   * Todos los mensajes de validación, incluyendo los de los objetos anidados.
   *
   * El `children` NO es opcional: `@ValidateNested()` deposita los errores de
   * `concepto` ahí adentro y el `constraints` del nivel superior queda `{}`. Leer
   * solo `constraints` devuelve `[]` para cualquier body mal formado, y un spec que
   * asegura `[]` pasa siempre —que es como el `@IsOptional()` olvidado llegó al
   * commit con el suite en verde. Los tests de abajo queacismiten "no error" no
   * tienen valor si esto no baja a mirar `children`.
   */
  async function errores(dto: Record<string, unknown>): Promise<string[]> {
    const instancia = plainToInstance(PagoIn, dto);
    const resultado = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });

    function aplanar(errores: ValidationError[]): string[] {
      return errores.flatMap((e) => [
        ...Object.values(e.constraints ?? {}),
        ...aplanar(e.children ?? []),
      ]);
    }

    return aplanar(resultado);
  }

  const cuerpo = { token: 'tok_aprobado_1' };

  it('acepta un concepto RESERVA_CANCHA con su id', async () => {
    expect(
      await errores({ ...cuerpo, concepto: { tipo: 'RESERVA_CANCHA', reserva_cancha_id: 7 } }),
    ).toEqual([]);
  });

  // Guarda contra una clase de DTO que parece validar y no valida, y contra un
  // helper que se traga los errores anidados. El caso del medio (`membresia_id: 0`
  // sin `reserva_cancha_id`) tiene que fallar SOLO por el `@Min` anidado: si el
  // `oneOf` también se disparara, su mensaje mencionaría `membresia_id` y el test
  // pasaría por el motivo equivocado —que es como pasaba antes.
  it('valida los ids del concepto aunque no sean de la rama elegida', async () => {
    const mensajes = await errores({
      ...cuerpo,
      concepto: { tipo: 'MEMBRESIA', membresia_id: 0 },
    });

    expect(mensajes).toContain('membresia_id must not be less than 1');
  });

  // La mitad del bug de `@IsOptional()`, y la que pateaba el e2e. Sin el
  // decorador, el id ausente de la rama no elegida dispara `@IsInt(undefined)` y
  // todo body bien formado da 422. Acá el id AUSENTE no puede producir error, y
  // como el helper baja a `children`, un `[]` acá sí significa "no hubo nada".
  it('no exige el id de la rama que no se está cobrando', async () => {
    expect(
      await errores({ ...cuerpo, concepto: { tipo: 'RESERVA_CANCHA', reserva_cancha_id: 7 } }),
    ).toEqual([]);
    expect(
      await errores({ ...cuerpo, concepto: { tipo: 'MEMBRESIA', membresia_id: 3 } }),
    ).toEqual([]);
  });

  it('rechaza el id de la OTRA rama si viene junto', async () => {
    const mensajes = await errores({
      ...cuerpo,
      concepto: { tipo: 'MEMBRESIA', reserva_cancha_id: 7, membresia_id: 3 },
    });

    expect(mensajes.join(' ')).toContain('no admite reserva_cancha_id');
  });

  it('rechaza una rama sin su id obligatorio', async () => {
    const mensajes = await errores({ ...cuerpo, concepto: { tipo: 'RESERVA_CANCHA' } });

    expect(mensajes.join(' ')).toContain('requiere reserva_cancha_id');
  });

  it('exige concepto y token (los dos required del contrato)', async () => {
    const mensajes = await errores({});

    expect(mensajes.join(' ')).toContain('concepto');
    expect(mensajes.join(' ')).toContain('token');
  });

  // RNF-02: no hay dónde mandar datos de tarjeta. Un `numero_tarjeta` desconocido
  // lo rechaza el ValidationPipe (forbidNonWhitelisted), y eso es la mitad
  // ejecutable de la garantía; la otra mitad es que el DTO no declara tal campo.
  it('rechaza un campo de tarjeta: no hay dónde mandarla', async () => {
    const mensajes = await errores({
      ...cuerpo,
      numero_tarjeta: '4111111111111111',
      concepto: { tipo: 'MEMBRESIA', membresia_id: 3 },
    });

    expect(mensajes.join(' ')).toContain('numero_tarjeta');
  });

  // El contrato declara `moneda` con `default: ARS` FUERA de `required`: omitirla
  // es el caso normal y no puede dar 422. El default a ARS lo pone el service.
  it('acepta el body sin moneda y rechaza una moneda que no es ARS', async () => {
    expect(await errores({ ...cuerpo, concepto: { tipo: 'MEMBRESIA', membresia_id: 3 } })).toEqual(
      [],
    );
    expect(
      (await errores({ ...cuerpo, moneda: 'USD', concepto: { tipo: 'MEMBRESIA', membresia_id: 3 } }))
        .join(' ')
        .toLowerCase(),
    ).toContain('moneda');
  });
});