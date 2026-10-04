-- TOTP para QR dinamico (RF-04, Unidad III). totp_secreto es NULL hasta que
-- el socio activa el QR con POST /auth/registro-qr; mientras tanto el ingreso
-- sigue validando solo membresia vigente (backward compatibility explicita
-- del plan de implementacion). qr_activo permite desactivarlo sin borrar el
-- secreto (revocacion simple, sin endpoint propio por ahora).
ALTER TABLE "Socio" ADD COLUMN "totp_secreto" TEXT;
ALTER TABLE "Socio" ADD COLUMN "qr_activo" BOOLEAN NOT NULL DEFAULT true;
