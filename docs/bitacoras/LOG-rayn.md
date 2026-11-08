# Bitácora de Trabajo — Santiago Rayn (P1)

> Registro individual de actividades, decisiones de arquitectura y resolución de problemas por Sprint y Unidad temática.
> Estructurado bajo el estándar de bitácoras del TFI de Programación V (UNER · FCAD).

---

## Entrada 1
- **Fecha:** 20/09/2026
- **Sprint y unidad:** Sprint 2 — Unidad II (Frameworks y Capa de Persistencia / M1 Usuarios y Membresías)
- **Actividad:** Implementé el Bloque 3 de M1: ciclo de vida y endpoints de membresías de socios (`POST` y `GET /socios/{socioId}/membresias`), con repositorio Prisma (`PrismaMembresiaRepository`), servicio de dominio con inyección desacoplada (`MEMBRESIA_REPOSITORY`) y DTOs tipados estrictos con validación de enums y serialización segura.
- **Decisión:** 
  - *Opción elegida:* Separar el contrato de repositorio en interfaz desacoplada de la implementación de Prisma (`PrismaMembresiaRepository`), integrando el cálculo de vigencia (`calcularVigencia`) directamente en la entidad de dominio.
  - *Alternativas evaluadas:* Calcular la vigencia directamente dentro del servicio NestJS o mediante triggers en PostgreSQL. Se optó por la función pura en la capa de entidades para maximizar la testeabilidad unitaria sin depender de la base ni del framework.
- **Problema o bloqueo:** 
  - *Bloqueo:* Al ejecutar los smoke tests contra la base de datos de Supabase, se generaban conflictos de unicidad cuando un socio intentaba dar de alta una segunda membresía activa.
  - *Resolución:* Se incorporó la validación previa de la regla 1:1 socio↔membresía activa respondiendo con `409 Conflict` antes del insert, y se normalizaron los retornos con `Location` en el status 201 según las convenciones REST acordadas.
- **Commits:** `77e707e`
- **Horas:** 6 horas

---

## Entrada 2
- **Fecha:** 22/09/2026
- **Sprint y unidad:** Sprint 2 — Unidad II (Infraestructura y Contenedores)
- **Actividad:** Redacté e integré en el `README.md` la guía de puesta en marcha paso a paso del backend y base de datos local tras la incorporación de Docker Compose al proyecto.
- **Decisión:**
  - *Opción elegida:* Diseñar una guía paso a paso basada en comandos de terminal directos y copiables (`docker compose up`, migraciones con Prisma y arranque en desarrollo).
  - *Alternativas evaluadas:* Delegar la documentación en un script bash de inicialización (`setup.sh`). Se decidió volcarlo en markdown para que cualquier integrante o docente entienda cada etapa del aprovisionamiento sin cajas negras.
- **Problema o bloqueo:**
  - *Bloqueo:* Diferencias entre los entornos locales con respecto a las variables de entorno de conexión (`DATABASE_URL`).
  - *Resolución:* Se documentó explícitamente el uso de `.env.example` con la cadena exacta de conexión local para evitar que se pisen configuraciones con la base remota.
- **Commits:** `05ec262`
- **Horas:** 2 horas

---

## Entrada 3
- **Fecha:** 26/09/2026
- **Sprint y unidad:** Sprint 3 — Unidad II (Arquitectura Modular / M3 Clases Grupales y Concurrencia)
- **Actividad:** Implementé la arquitectura completa del módulo M3 (Clases Grupales): gestión de agenda con validación de sede y cálculo dinámico de aforo (RF-06), reservas concurrentes con lock pesimista atómico (RF-07), lista de espera automática basada en patrón Observer con confirmación first-come (RF-08), Casos de Uso formales, script seed SQL y suite e2e.
- **Decisión:**
  - *Opción elegida:* Utilizar `SELECT ... FOR UPDATE` (lock pesimista) dentro de una transacción interactiva de Prisma para garantizar atomicidad estricta al reservar cupos en clases concurrentes. Implementar la notificación de cupo liberado mediante el patrón Observer (Subject/Observer desacoplado).
  - *Alternativas evaluadas:* Optimistic Locking (`version` column). Se descartó porque en clases con alta demanda y cupos limitados (ej. spinning con 15 lugares) produce excesivos reintentos y excepciones en el cliente.
- **Problema o bloqueo:**
  - *Bloqueo:* Las cancelaciones tardías de reservas generaban cupos liberados pero podían producir carreras entre los socios en lista de espera al intentar confirmar el lugar.
  - *Resolución:* Se definió la transición de estado `NOTIFICADO` con confirmación por primer arribo (*first-come, first-served*) y baja lógica (`CANCELADO`) respaldada por un índice único parcial en la base de datos para evitar duplicados activos.
- **Commits:** `ff0afda`
- **Horas:** 8 horas

---

## Entrada 4
- **Fecha:** 17/10/2026
- **Sprint y unidad:** Sprint 5 — Unidad III (Diseño de API, OpenAPI y Paginación Uniforme)
- **Actividad:** Implementé el envoltorio estándar `{ items, total }` en todas las operaciones GET de listado de los 5 módulos (M1 a M5), diseñé los 11 DTOs de Swagger correspondientes, creé la abstracción `PaginatedResult<T>` y alineé el contrato `openapi.yaml`.
- **Decisión:**
  - *Opción elegida:* Envolver las respuestas de listados en un objeto `{ items: T[], total: number }` en lugar de devolver arreglos planos.
  - *Alternativas evaluadas:* Paginación por headers HTTP (`X-Total-Count`, `Link`). Se optó por el cuerpo JSON con envoltorio `{ items, total }` porque simplifica el consumo reactivo en el frontend (Vue 3 / TypeScript) y respeta la especificación OpenAPI de la materia.
- **Problema o bloqueo:**
  - *Bloqueo:* Al modificar la estructura de respuesta de los listados, fallaron 59 pruebas de integración y e2e que esperaban arrays planos directamente en `res.body`.
  - *Resolución:* Se refactorizaron sistemáticamente las aserciones de pruebas en los 5 módulos para validar `res.body.items` y `res.body.total`, recuperando el 100% de la suite en verde.
- **Commits:** `d5e6bae`, `c05fb13`
- **Horas:** 5 horas

---

## Entrada 5
- **Fecha:** 23/10/2026
- **Sprint y unidad:** Sprint 6 — Unidad IV (Frontend Vue 3: M2 Gimnasio, Acceso y Aforo en Tiempo Real)
- **Actividad:** Desarrollé el módulo de Gimnasio y Acceso en el frontend: dashboard de aforo en tiempo real (RF-05), registro y validación de ingresos (RF-04), egreso de socios, historial de accesos, soporte para alta de sedes para GERENTE (RNF-04) y estructura base para sincronización offline (RNF-01).
- **Decisión:**
  - *Opción elegida:* Implementar una cola local de contingencia en `localStorage` mediante el composable `useSincronizacionOffline` para almacenar ingresos/egresos cuando no hay conectividad.
  - *Alternativas evaluadas:* Almacenar únicamente en memoria reactiva (se pierde ante un refresh de página) o implementar IndexedDB con Dexie.js (se consideró sobrediseño innecesario dado el tamaño acotado del lote de contingencia).
- **Problema o bloqueo:**
  - *Bloqueo:* En la pantalla de aforo en vivo, las consultas frecuentes sobrecargaban la vista o generaban inconsistencias visuales si el usuario navegaba a otra pestaña.
  - *Resolución:* Se creó el composable `useActualizacionPeriodica` que pausa el polling automático cuando el documento pierde visibilidad (`document.visibilityState === 'hidden'`), reanudándolo al volver.
- **Commits:** `91d0908`
- **Horas:** 7 horas

---

## Entrada 6
- **Fecha:** 28/10/2026
- **Sprint y unidad:** Sprint 6 — Unidad IV (Frontend: Identidad Visual y UI)
- **Actividad:** Creé e incorporé el logo vectorial SVG de FitZone Sports (`logofzsvg.svg`) y adapté los componentes base (`MarcaFz.vue`, `ArmazonApp.vue` y `LoginPage.vue`) para soportar renderizado con `fill="currentColor"`.
- **Decisión:**
  - *Opción elegida:* SVG en línea con `fill="currentColor"` para que el isotipo responda automáticamente tanto a temas claros como a modo oscuro sin duplicar assets.
  - *Alternativas evaluadas:* Imágenes PNG rasterizadas para cada variante de tema. Descartado por pixelado en pantallas de alta densidad y falta de adaptabilidad a tokens CSS.
- **Problema o bloqueo:**
  - *Bloqueo:* La inicial textual anterior rompía la alineación de altura en el sidebar colapsado.
  - *Resolución:* Se parametrizó `logoUrl` como prop opcional con fallback elegante y se agregó suite de pruebas en `MarcaFz.spec.ts`.
- **Commits:** `829af21`
- **Horas:** 2 horas

---

## Entrada 7
- **Fecha:** 07/11/2026
- **Sprint y unidad:** Sprint 7 — Unidad V (Cierre de Documentación y Entregables)
- **Actividad:** Reestructuré la documentación del proyecto para cumplir con los requerimientos formales del TFI (UNER · FCAD): armado de bitácoras por integrante, tabla de trazabilidad y reescritura del `README.md` con los 6 puntos obligatorios de la cátedra.
- **Decisión:**
  - *Opción elegida:* Separar las bitácoras individuales en archivos independientes (`docs/bitacoras/LOG-<integrante>.md`) manteniendo `LOG.md` como registro histórico general.
  - *Alternativas evaluadas:* Mantener un único archivo monolítico de bitácora. Descartado para facilitar la corrección docente y el cruce con los usuarios de Git.
- **Problema o bloqueo:**
  - *Bloqueo:* La cátedra exige que un docente en una máquina limpia pueda clonar y levantar la app en 5 pasos sin preguntar nada al equipo.
  - *Resolución:* Se diseñaron 5 pasos unificados en bash que levantan la base local con Docker, migran, aplican el seed completo e inician backend y frontend concurrentemente.
- **Commits:** `710f244`
- **Horas:** 3 horas

---

## Entrada 8
- **Fecha:** 07/11/2026
- **Sprint y unidad:** Sprint 8 — Unidad III y IV (Acceso, Seguridad TOTP y Frontend Dinámico / RF-04)
- **Actividad:** Implementé el flujo completo de credencial QR dinámico y escáner óptico para el control de acceso: generación en el carnet del socio del código QR dinámico con payload JSON (`{ socioId, codigoTotp }`) recalculado cada 30 segundos con temporizador visual, y creación del modal de escaneo con cámara web (`ModalEscanearQr.vue`) en la recepción para validación inmediata (*one-shot*). Además, corregí las discrepancias del script de seed SQL (`precio`, `horario_inicio/fin`, `socio_id` y hash bcrypt).
- **Decisión:**
  - *Opción elegida:*
    1. Utilizar la librería estándar `otpauth` en el frontend para calcular localmente el token TOTP sincronizado con la hora del sistema a partir del secreto del socio, regenerando el código cada 30s.
    2. Usar `html5-qrcode` para la lectura de cámara con selector de dispositivo (trasera/frontal) y parseo seguro de payload JSON.
    3. Validación *one-shot*: al detectar el QR, cerrar la cámara y disparar la registración de inmediato sin requerir clics adicionales del recepcionista.
  - *Alternativas evaluadas:*
    - *Polling periódico al backend:* Pedir el código al servidor cada 30s aumentaría la carga de red innecesariamente; el algoritmo TOTP (RFC 6238) está diseñado matemáticamente para calcularse en cliente.
    - *BarcodeDetector API nativa:* No posee soporte homogéneo en todos los navegadores de escritorio (como Firefox o Safari). `html5-qrcode` garantiza soporte universal.
- **Problema o bloqueo:**
  - *Bloqueo 1:* La versión moderna de `otplib` requería un tamaño mínimo estricto de secreto que fallaba con los secretos de 16 caracteres generados por el backend. Se resolvió migrando a `otpauth`, que calcula el estándar SHA1/30s de forma idéntica a `otplib` en el backend.
  - *Bloqueo 2:* El script `seed_supabase_test_data.sql` fallaba en bases de datos locales por columnas desactualizadas (`horario`, `precio`) y contraseñas con hash inválido que impedían el login de prueba. Se actualizaron las sentencias SQL y se colocó el hash bcrypt válido de `Password123!`.
- **Commits:** `8a91946`
- **Horas:** 4 horas


---

## Entrada 9
- **Fecha:** 07/11/2026
- **Sprint y unidad:** Sprint 8 — Unidad I (Arquitectura y Documentación Técnica / Consolidación de ADRs)
- **Actividad:** Migré y formalicé todos los Registros de Decisión Arquitectónica (ADRs) trabajados originariamente en la Unidad I hacia markdowns independientes dentro de `docs/adr/`, aplicando el estándar riguroso de la cátedra con tabla de alternativas, contexto, decisión justificada, consecuencias y trazabilidad de requisitos. Mapeé los ADRs obligatorios (ADR-001 a ADR-009) y preservé las decisiones de diseño adicionales del equipo (ADR-010 a ADR-013). Realicé un análisis exhaustivo de coherencia con la implementación real del código, actualizando ADR-001 (evolución de Mediador hacia inyección explícita y bus de eventos) y completando los 4 ADRs obligatorios faltantes (ADR-003, ADR-004, ADR-007, ADR-008) con detalle técnico y tag `[A REVISAR]`. Actualicé el `README.md` vinculando el índice de ADRs.
- **Decisión:**
  - *Opción elegida:* Migrar cada decisión a un archivo markdown propio (`ADR-0NN.md`) correlativo en lugar de mantener un documento centralizado en el vault externo, catalogando los 9 ADRs obligatorios solicitados por la cátedra e integrando los patrones propios (Observer, Strategy, Repository y Capas) a partir de ADR-010. Detallar la implementación real en los obligatorios pendientes señalizándolos con `[A REVISAR]` para validación final del equipo.
  - *Alternativas evaluadas:* Conservar las decisiones en el documento consolidado de arquitectura o en el PDF del Sprint 1. Se descartó porque la cátedra exige que los ADRs vivan versionados individualmente en el repositorio para facilitar su auditoría y cruce con el código fuente.
- **Problema o bloqueo:**
  - *Bloqueo:* Las decisiones de la Unidad I se encontraban documentadas en el vault del equipo bajo formato libre de tablas agrupadas, sin coincidir estrictamente con la plantilla individual requerida para la entrega final; además, ADR-001 citaba un `MediadorService` que había sido refactorizado y eliminado en Octubre.
  - *Resolución:* Se extrajo y reestructuró cada registro individualmente garantizando que todas las decisiones cuenten con su tabla comparativa de alternativas, consecuencias y justificación técnica determinativa, alineando la evolución real del código (inyección explícita, constraints de exclusión GiST, cola offline y pirámide de pruebas).
- **Commits:** `60fcf3a`
- **Horas:** 4 horas
