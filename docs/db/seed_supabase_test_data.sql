-- ============================================================================
-- FitZone Sports — Script de Poblado de Datos de Prueba (Seed SQL)
-- Base de Datos: PostgreSQL / Supabase
-- Entorno: Desarrollo, Testing y Validación de Endpoints REST
-- ============================================================================
--
-- RESUMEN DE REGISTROS INSERTADOS POR TABLA:
-- ----------------------------------------------------------------------------
-- 1.  "Sede"             : 3 registros (Central Belgrano, Palermo, Caballito)
-- 2.  "Usuario"          : 6 registros (1 Gerente, 1 Recepción, 3 Socios, 1 Externo)
-- 3.  "EmpleadoSede"     : 1 registro  (Staff asignado a Sede Central)
-- 4.  "Socio"            : 3 registros (Socios vinculados a Usuario y Sede)
-- 5.  "Membresia"        : 3 registros (2 Activas vigentes, 1 Vencida en MORA)
-- 6.  "Cancha"           : 3 registros (Paddle, Fútbol 5; Operativas y Mantenimiento)
-- 7.  "Clase"            : 4 registros (Spinning, CrossFit, Yoga, Boxeo)
-- 8.  "Reserva" (Cancha) : 2 registros (1 Confirmada, 1 Cancelada)
-- 9.  "ReservaClase"     : 3 registros (2 en Clase CrossFit [Aforo 100%], 1 en Spinning)
-- 10. "EsperaClase"      : 3 registros (1 EN_ESPERA, 1 NOTIFICADO, 1 CANCELADO)
-- 11. "Pago"             : 3 registros (Membresía, Reserva Cancha, Pase Diario)
-- 12. "PagoReserva"      : 1 registro  (Herencia 1:1 con Pago)
-- 13. "PagoMembresia"    : 1 registro  (Herencia 1:1 con Pago)
-- 14. "Ingreso" (Acceso) : 3 registros (1 Finalizado, 1 Activo dentro, 1 Offline)
-- ----------------------------------------------------------------------------
-- TOTAL TABLAS POBLADAS: 14 tablas relacionales coherentes.
-- ============================================================================

-- INICIO DE TRANSACCIÓN ATÓMICA
BEGIN;

-- ============================================================================
-- PASO 0: LIMPIEZA IDEMPOTENTE (RESTART IDENTITY + CASCADE)
-- ============================================================================
-- Se eliminan todos los datos previos y se reinician las secuencias de IDs (SERIAL)
-- para garantizar que la ejecución repetida sea 100% limpia y reproducible.
TRUNCATE TABLE 
  "PagoReserva",
  "PagoMembresia",
  "Pago",
  "EsperaClase",
  "ReservaClase",
  "Reserva",
  "Ingreso",
  "Clase",
  "Cancha",
  "Membresia",
  "EmpleadoSede",
  "Socio",
  "Usuario",
  "Sede"
RESTART IDENTITY CASCADE;


-- ============================================================================
-- 1. TABLA: "Sede" (RF-04, RF-05, RNF-04)
-- ============================================================================
-- Representa las sucursales físicas de FitZone Sports con aforo controlado.
INSERT INTO "Sede" ("id", "nombre", "direccion", "aforo_maximo") VALUES
  (1, 'Sede Central Belgrano', 'Av. Cabildo 2450, CABA', 50),
  (2, 'Sede Palermo Hollywood', 'Humboldt 1980, CABA', 35),
  (3, 'Sede Caballito Express', 'Av. Rivadavia 5300, CABA', 25);


-- ============================================================================
-- 2. TABLA: "Usuario" (RF-01, Autenticación y Perfil por Rol)
-- ============================================================================
-- Contiene superclase Usuario.
-- Hash de contraseña utilizado: bcrypt ('Password123!') -> $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO "Usuario" ("id", "rol", "dni", "nombre", "email", "contrasenia", "telefono", "foto_url") VALUES
  -- Rol Gerente (A4)
  (1, 'GERENTE', '28111222', 'Valeria Rossi', 'valeria.rossi@fitzone.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+5491144440001', 'https://fitzone.app/avatars/valeria.jpg'),
  -- Rol Recepción (A3 - Staff asignado a sucursal)
  (2, 'RECEPCION', '35333444', 'Lucas Benítez', 'lucas.benitez@fitzone.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+5491144440002', 'https://fitzone.app/avatars/lucas.jpg'),
  -- Socios (A1)
  (3, 'SOCIO', '38555666', 'Camila Domínguez', 'camila.dominguez@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+5491144440003', 'https://fitzone.app/avatars/camila.jpg'),
  (4, 'SOCIO', '40777888', 'Joaquín Pereyra', 'joaquin.pereyra@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+5491144440004', 'https://fitzone.app/avatars/joaquin.jpg'),
  (5, 'SOCIO', '33999000', 'Esteban Morales', 'esteban.morales@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+5491144440005', 'https://fitzone.app/avatars/esteban.jpg'),
  -- Externo (A2 - Cliente que no es socio regular)
  (6, 'EXTERNO', '42111333', 'Sofía Navarro', 'sofia.navarro@hotmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '+5491144440006', 'https://fitzone.app/avatars/sofia.jpg');


-- ============================================================================
-- 3. TABLA: "EmpleadoSede" (Staff 1:1 con Usuario y Sede)
-- ============================================================================
-- Asigna al usuario de rol RECEPCION como staff de la Sede Central Belgrano.
INSERT INTO "EmpleadoSede" ("id", "usuario_id", "sede_id") VALUES
  (1, 2, 1);


-- ============================================================================
-- 4. TABLA: "Socio" (RF-01, Subtipo 1:1 de Usuario)
-- ============================================================================
-- Vincula los usuarios con perfil SOCIO a su sede de origen.
INSERT INTO "Socio" ("id", "usuario_id", "sede_origen_id", "fecha_alta") VALUES
  (1, 3, 1, NOW() - INTERVAL '90 days'), -- Camila en Sede Central
  (2, 4, 2, NOW() - INTERVAL '45 days'), -- Joaquín en Sede Palermo
  (3, 5, 1, NOW() - INTERVAL '120 days'); -- Esteban en Sede Central


-- ============================================================================
-- 5. TABLA: "Membresia" (RF-02, Ciclo de Vida y Regla de Mora)
-- ============================================================================
-- EDGE CASE 1 (MORA):
-- - Socio 1 (Camila): Membresía ACTIVA (Plan ANUAL) -> Al día.
-- - Socio 2 (Joaquín): Membresía ACTIVA (Plan MENSUAL) -> Al día.
-- - Socio 3 (Esteban): Membresía VENCIDA (fecha_fin en el pasado).
--   Permite probar que M3 rechaza su reserva gratuita con HTTP 403 ('socio-en-mora').
INSERT INTO "Membresia" ("id", "socio_id", "plan", "estado", "fecha_inicio", "fecha_fin", "renueva_automatica") VALUES
  (1, 1, 'ANUAL', 'ACTIVA', NOW() - INTERVAL '90 days', NOW() + INTERVAL '275 days', true),
  (2, 2, 'MENSUAL', 'ACTIVA', NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', false),
  (3, 3, 'TRIMESTRAL', 'VENCIDA', NOW() - INTERVAL '120 days', NOW() - INTERVAL '30 days', false);


-- ============================================================================
-- 6. TABLA: "Cancha" (RF-09, Espacios Deportivos en Sedes)
-- ============================================================================
-- Diferentes tipos y estados para probar reservas de canchas (M4).
INSERT INTO "Cancha" ("id", "sede_id", "tipo", "costo_por_hora", "estado") VALUES
  (1, 1, 'PADDLE', 8500.00, 'OPERATIVA'),
  (2, 1, 'FUTBOL5', 16000.00, 'OPERATIVA'),
  (3, 2, 'PADDLE', 9000.00, 'EN_MANTENIMIENTO');


-- ============================================================================
-- 7. TABLA: "Clase" (RF-06, Agenda de Clases Grupales M3)
-- ============================================================================
-- Fechas dinámicas calculadas en formato ISO-8601 UTC string (exactos 20 caracteres):
-- - Clase 1: Spinning dentro de 24 hs (capacidad 15, disponible para reserva normal).
-- - Clase 2: CrossFit dentro de 18 hs (capacidad 2, LLENA para probar lista de espera).
-- - Clase 3: Yoga dentro de 96 hs / 4 días (para probar rechazo de reserva anticipada > 48h).
-- - Clase 4: Boxeo dentro de 1 hora (para probar rechazo de cancelación sin penalidad < 2h).
INSERT INTO "Clase" ("id", "sede_id", "tipo", "instructor", "horario", "capacidad") VALUES
  (1, 1, 'Spinning', 'Martín Palermo', TO_CHAR(NOW() AT TIME ZONE 'UTC' + INTERVAL '24 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 15),
  (2, 1, 'CrossFit', 'Franco Colapinto', TO_CHAR(NOW() AT TIME ZONE 'UTC' + INTERVAL '18 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 2),
  (3, 2, 'Yoga Relax', 'Anahí Silva', TO_CHAR(NOW() AT TIME ZONE 'UTC' + INTERVAL '96 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 20),
  (4, 1, 'Boxeo Training', 'Sergio Martínez', TO_CHAR(NOW() AT TIME ZONE 'UTC' + INTERVAL '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 10);


-- ============================================================================
-- 8. TABLA: "Reserva" (Cancha - RF-10, M4)
-- ============================================================================
-- 1 reserva confirmada y 1 reserva cancelada para validar historial y solapamientos.
INSERT INTO "Reserva" ("id", "cancha_id", "usuario_id", "fecha_hora_inicio", "fecha_hora_fin", "estado", "precio_aplicado") VALUES
  (1, 1, 3, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 1 hour', 'CONFIRMADA', 8500.00),
  (2, 2, 6, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '1 hour', 'CANCELADA', 16000.00);


-- ============================================================================
-- 9. TABLA: "ReservaClase" (RF-07, Reservas de Clases Grupales M3)
-- ============================================================================
-- - Clase 1: 1 reserva activa (quedan 14 lugares libres de 15).
-- - Clase 2: 2 reservas activas (Socio 1 y Socio 2).
--   Capacidad de Clase 2 = 2 -> AFORO 100% LLENO (dispara la lista de espera RF-08).
INSERT INTO "ReservaClase" ("id", "clase_id", "socio_id", "estado") VALUES
  (1, 1, 1, 'CONFIRMADA'),
  (2, 2, 1, 'CONFIRMADA'),
  (3, 2, 2, 'CONFIRMADA');


-- ============================================================================
-- 10. TABLA: "EsperaClase" (RF-08, Lista de Espera y Observer M3)
-- ============================================================================
-- EDGE CASE 2 (CICLO DE VIDA LISTA DE ESPERA):
-- - Espera 1: Socio 3 en Clase 2 (EN_ESPERA, esperando cupo liberado).
-- - Espera 2: Socio 1 en Clase 4 (NOTIFICADO, listo para confirmar first-come).
-- - Espera 3: Socio 2 en Clase 4 (CONFIRMADO, caso de espera ya confirmada).
-- (Nota: Para usar el estado CANCELADO, asegúrate de haber ejecutado antes:
--  ALTER TYPE "EstadoEspera" ADD VALUE IF NOT EXISTS 'CANCELADO';)
INSERT INTO "EsperaClase" ("id", "clase_id", "socio_id", "estado", "fecha_anotacion", "fecha_notificacion", "fecha_confirmacion") VALUES
  (1, 2, 3, 'EN_ESPERA', NOW() - INTERVAL '2 hours', NULL, NULL),
  (2, 4, 1, 'NOTIFICADO', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '10 minutes', NULL),
  (3, 4, 2, 'CONFIRMADO', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes');



-- ============================================================================
-- 11. TABLA: "Pago" (RF-13, Supertabla de Pagos)
-- ============================================================================
-- Pagos registrados con tokens opacos e idempotencia única.
INSERT INTO "Pago" ("id", "usuario_id", "idempotencia_key", "fecha_pago", "monto", "moneda", "estado", "token", "comprobante_pdf_url") VALUES
    -- fecha_pago se declara explicito (la columna tiene DEFAULT now()): sin esto los tres
    -- pagos quedan con la fecha del seed y GET /pagos?desde=&hasta= no tiene nada que filtrar.
    -- Las tres fechas se espacian a proposito (-90d, -3d, -1d) para que el filtro por periodo
    -- tenga casos: un pago de hace 3 meses, uno de hace 3 dias y uno de ayer.
    (1, 3, 'idem-membresia-socio-1-2026', NOW() - INTERVAL '90 days', 45000.00, 'ARS', 'APROBADO', 'tok_visa_4242_approved_001', 'https://fitzone.app/comprobantes/pago-001.pdf'),
    (2, 3, 'idem-reserva-cancha-1-2026', NOW() - INTERVAL '3 days', 8500.00, 'ARS', 'APROBADO', 'tok_master_5555_approved_002', 'https://fitzone.app/comprobantes/pago-002.pdf'),
    (3, 6, 'idem-pase-externo-6-2026', NOW() - INTERVAL '1 day', 3500.00, 'ARS', 'APROBADO', 'tok_visa_1111_approved_003', NULL);


-- ============================================================================
-- 12. TABLA: "PagoReserva" (Subtipo de Pago 1:1 con Reserva Cancha)
-- ============================================================================
INSERT INTO "PagoReserva" ("id_pago", "reserva_id") VALUES
  (2, 1);


-- ============================================================================
-- 13. TABLA: "PagoMembresia" (Subtipo de Pago con Membresía)
-- ============================================================================
INSERT INTO "PagoMembresia" ("id_pago", "membresia_id") VALUES
  (1, 1);


-- ============================================================================
-- 14. TABLA: "Ingreso" (RF-04, Control de Acceso y Aforo en Tiempo Real M2)
-- ============================================================================
-- EDGE CASE 3 (AFORO Y ACCESO DUPLICADO RN-01):
-- - Ingreso 1: Usuario 3 egresó normalmente (acceso cerrado).
-- - Ingreso 2: Usuario 4 está ADENTRO de Sede Central ('fecha_hora_egreso' IS NULL).
--   Aforo actual de Sede Central = 1.
--   Prueba de RN-01: Si Usuario 4 intenta ingresar a cualquier sede, el índice
--   parcial 'ingreso_usuario_abierto_unq' rechaza la petición.
-- - Ingreso 3: Usuario 5 ingresó en Sede Palermo con validación offline (RNF-01).
INSERT INTO "Ingreso" ("id", "sede_id", "usuario_id", "fecha_hora_ingreso", "fecha_hora_egreso", "validado_offline") VALUES
  (1, 1, 3, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', false),
  (2, 1, 4, NOW() - INTERVAL '40 minutes', NULL, false),
  (3, 2, 5, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '30 minutes', true);


-- ============================================================================
-- PASO FINAL: AJUSTE DE SECUENCIAS SERIAL (POSTGRESQL)
-- ============================================================================
-- Sincroniza las secuencias autoincrementales con los IDs explícitos insertados.
-- Esto asegura que los futuros 'POST' de la API no choquen con claves primarias existentes.
SELECT setval(pg_get_serial_sequence('"Sede"', 'id'), coalesce(max("id"), 1)) FROM "Sede";
SELECT setval(pg_get_serial_sequence('"Usuario"', 'id'), coalesce(max("id"), 1)) FROM "Usuario";
SELECT setval(pg_get_serial_sequence('"EmpleadoSede"', 'id'), coalesce(max("id"), 1)) FROM "EmpleadoSede";
SELECT setval(pg_get_serial_sequence('"Socio"', 'id'), coalesce(max("id"), 1)) FROM "Socio";
SELECT setval(pg_get_serial_sequence('"Membresia"', 'id'), coalesce(max("id"), 1)) FROM "Membresia";
SELECT setval(pg_get_serial_sequence('"Cancha"', 'id'), coalesce(max("id"), 1)) FROM "Cancha";
SELECT setval(pg_get_serial_sequence('"Clase"', 'id'), coalesce(max("id"), 1)) FROM "Clase";
SELECT setval(pg_get_serial_sequence('"Reserva"', 'id'), coalesce(max("id"), 1)) FROM "Reserva";
SELECT setval(pg_get_serial_sequence('"ReservaClase"', 'id'), coalesce(max("id"), 1)) FROM "ReservaClase";
SELECT setval(pg_get_serial_sequence('"EsperaClase"', 'id'), coalesce(max("id"), 1)) FROM "EsperaClase";
SELECT setval(pg_get_serial_sequence('"Pago"', 'id'), coalesce(max("id"), 1)) FROM "Pago";
SELECT setval(pg_get_serial_sequence('"Ingreso"', 'id'), coalesce(max("id"), 1)) FROM "Ingreso";

-- CONFIRMAR TRANSACCIÓN
COMMIT;

-- ============================================================================
-- FIN DEL SCRIPT SEED
-- ============================================================================
