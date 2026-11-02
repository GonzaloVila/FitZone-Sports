# Auditoría de guards y alcance por rol (backend)

Relevamiento de solo lectura sobre `backend/src`, `docs/openapi.yaml` y `frontend/src`. No se tocó código. Modelo a seguir: commit `57dd1c1` (pagos).

**Siglas:** S = SOCIO · E = EXTERNO · R = RECEPCION · G = GERENTE. `✗` = sin guards en el código y sin `security`/401/403 en el contrato (en todos los `✗` código y contrato coinciden). "Ruta front" = pantalla y roles que la ven.

## 1. Resumen

- **54 endpoints en 15 controllers** (auth 4, bloqueados 1, usuarios 4, socios 5, membresías 2, sedes 3, ingresos 4, sincronización 1, canchas 6, clases 5, reservas-canchas 4, reservas-clases 4, esperas 5, pagos 5, reportes 1).
- **11 con guards** (JwtAuthGuard + RolesGuard): `registro-qr`, `bloqueados`, `GET /ingresos`, `egreso`, `sincronizacion/ingresos`, los 5 de pagos, `reportes/pagos`.
- **3 públicos por diseño**: `login`, `refresh`, `logout` (sin guard, se autentican por credenciales o refresh token).
- **40 sin protección**: usuarios 4, socios 5, membresías 2, sedes 3, `GET /ingresos/{id}`, `POST /ingresos`, canchas 6, clases 5, reservas-canchas 4, reservas-clases 4, esperas 5.
- No hay `APP_GUARD`, ni `@Public()`, ni throttling en el repo.
- Código y contrato coinciden en lo ya protegido. Matices: pagos usa guards a nivel de clase; ingresos, bloqueados, auth y reportes los ponen por método. El 403 del contrato convive con otros 403 de negocio (membresía inactiva en `POST /ingresos`, mora en `POST /reservas-clases` y `POST /clases/{id}/espera`): mismo status, distinto `detail`.
- El contrato cierra con `security: []` global (sin seguridad por defecto): con un guard global habría que invertirlo.

### Roles y sesión
- Roles (`RolUsuario`): `SOCIO | EXTERNO | RECEPCION | GERENTE`. `POST /usuarios` solo crea EXTERNO, RECEPCION o GERENTE (`RolAlta`); SOCIO se obtiene por `POST /socios`; `DELETE /socios/{id}` lo vuelve EXTERNO.
- `UsuarioAutenticado` (JWT, access de 15 min): `userId` (siempre), `rol`, `sedeId` (solo RECEPCION), `socioId` (solo SOCIO). GERENTE no tiene sede; E no tiene socio.
- El rol, la sede y el socioId quedan fijados al login: un cambio (alta o baja de socio) se ve recién con el próximo refresh (hasta 15 min).
- El frontend adjunta el Bearer a **todas** las llamadas y renueva ante 401 (`clienteApi.ts`): cerrar endpoints no rompe a quien tiene sesión. Solo `login`, `refresh` y `logout` se llaman sin token.

### Identificar al dueño
| Recurso | Dueño | Con qué se compara en la sesión | Servicio existente |
|---|---|---|---|
| Reserva de cancha | `usuarioId` | `userId` | `ReservaPrecioService.obtenerParaCobro` (devuelve `usuarioId`) |
| Reserva de clase | `socioId` (y `usuarioId` vía `SociosService.obtenerUsuarioIdPorSocio`) | `socioId` o `userId` | `ReservaClasePrecioService.obtenerParaCobro` (devuelve `socioId` y `usuarioId`) |
| Espera de clase | `socioId` | `socioId` | no hay; la entidad lleva `socioId` |
| Membresía (`/socios/{socioId}/membresias`) | `socioId` de la ruta | `socioId` | `MembresiaPrecioService.obtenerParaCobro` (por `membresiaId`, no por socio) |
| Socio / usuario (`/{id}`) | id de la ruta | `socioId` / `userId` | `SociosService`, `UsuariosService` |
| Pago | `usuarioId` | `userId` | ya resuelto en `PagosAccesoService` |
Sede disponible: ingreso (`sedeId`), cancha (`sedeId`), clase (`sedeId`, y la reserva/espera por la clase), socio (`sedeOrigenId`, "informativa" según el DTO). Pagos y usuarios no tienen sede directa.

## 2. Tablas por módulo
Propuesta de acceso: **PÚBLICO**, **SESIÓN**, **ROLES (…)** o **DUEÑO** (S y E solo lo suyo con 404 si es ajeno; R y G todo salvo que se indique). Los `D#` remiten a la sección 8 (dudas).

### auth (`auth.controller.ts`)
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| POST /auth/login (`login`) | sin guards; contrato 401 | LoginPage (pública) | PÚBLICO: es el acceso | — | — |
| POST /auth/refresh (`refrescarToken`) | sin guards; contrato 401/403 | clienteApi (renovación en 401) y `restaurar` al abrir/F5 | PÚBLICO: autentica por refresh token | — | Cookie exige Origin permitido |
| POST /auth/logout (`cerrarSesion`) | sin guards; contrato 403 | sesionStore | PÚBLICO: idempotente, por refresh token | — | — |
| POST /auth/registro-qr (`registrarQr`) | Jwt+Roles(S) por método; contrato OK | CarnetPage (S) | Sin cambios: ROLES S | Usa `userId` del token | — |

### m1 · usuarios (`usuarios.controller.ts`)
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| POST /usuarios (`crearUsuario`) | ✗ (da 201 sin sesión) | `/personal` (G crea R); alta de socio (R,G crean un E) | ROLES R, G | R sin sede propia que aplicar | D1: ¿R puede crear RECEPCION/GERENTE o solo G? |
| GET /usuarios (`listarUsuarios`) | ✗ | `/personal` (G, rol R); buscador del alta de socio (R,G, rol E) | ROLES R, G | Sin sede (los E no tienen) | Devuelve dni y email: S y E no deben listar |
| GET /usuarios/{id} (`obtenerUsuario`) | ✗ | ArmazonApp: **todos** los roles piden el propio; DetalleSocio (R,G); "reservantes del día" (R,G, ids ajenos) | DUEÑO | S/E: `id == userId`; R,G todos | Sin esto el armazón de S/E pierde nombre y email |
| PATCH /usuarios/{id} (`modificarUsuario`) | ✗ | ModalEditarDatos en DetalleSocio (R,G) | DUEÑO (el propio también, aunque no hay pantalla) | S/E: solo el propio | D2: R puede cambiar la contraseña de otro R/G |

### m1 · socios (`socios.controller.ts`)
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| POST /socios (`crearSocio`) | ✗ | ModalAltaSocio `/socios` (R,G) | ROLES R, G | — | Cobra la membresía inicial (evento interno) |
| GET /socios (`listarSocios`) | ✗ | `/socios` (R,G) | ROLES R, G | Sin restricción por sede (`sedeOrigenId` es informativa, acceso multi-sede RF-03) | D3 |
| GET /socios/{socioId} (`obtenerSocio`) | ✗ | DetalleSocio (R,G); **CarnetPage (S, propio)** vía `useDetalleSocio` | DUEÑO | S: `socioId` de la ruta == token; E nunca (no tiene socio) | — |
| PATCH /socios/{socioId} (`modificarSocio`) | ✗ | DetalleSocio, cambiar sede (R,G) | ROLES R, G | — | S no cambia su sede de origen hoy |
| DELETE /socios/{socioId} (`dejarDeSerSocio`) | ✗ | acciones de socio (R,G) | ROLES R, G | — | D1 (¿solo G?) |

### m1 · membresías y bloqueados
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| GET /socios/{socioId}/membresias (`obtenerMembresia`) | ✗ | `/socios` y DetalleSocio (R,G); CarnetPage (S) | DUEÑO | S: `socioId` == token; E → 404 | — |
| PATCH /socios/{socioId}/membresias (`modificarMembresia`) | ✗ | cambiar plan, suspender, renovación automática (R,G) | ROLES R, G | — | D4: ¿S puede frenar su renovación? `useDetalleSocio` (que usa el Carnet) tiene el método; verificar que el Carnet no lo muestre. Cobra el plan nuevo |
| GET /bloqueados (`listarBloqueados`) | Jwt+Roles(R,G) por método; contrato OK | ninguna pantalla | Sin cambios | — | Sin caller en el front |

### m2 · gimnasio (`sedes`, `ingresos`, `sincronizacion`)
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| GET /sedes (`listarSedes`) | ✗ | Casi todas las pantallas y el armazón, **los 4 roles** (nombre de sede) | SESIÓN | — | Ninguna pantalla pública lo usa (el login no) |
| POST /sedes (`crearSede`) | ✗ (da 201 sin sesión) | AforoPage → ModalNuevaSede (solo G) | ROLES G | — | — |
| GET /sedes/{sedeId}/aforo (`obtenerAforo`) | ✗ | AforoPage (R,G) | ROLES R, G | R: su sede (ya fija en la UI); el dato está en el JWT | D5 (¿público?) |
| GET /ingresos (`listarIngresos`) | Jwt+Roles(R,G); contrato OK | Historial y "personas dentro" (R,G) | Sin cambios | R fuerza su `sedeId` | — |
| GET /ingresos/{ingresoId} (`obtenerIngreso`) | ✗ (único GET del módulo abierto) | Ninguna pantalla (existe en el servicio, sin uso) | ROLES R, G | R solo su sede (`ingreso.sedeId` vs `sedeId` JWT) | D6: ¿404 o 403 para otra sede? Egreso usa 403 |
| POST /ingresos (`registrarIngreso`) | ✗ (contrato: 403 membresía inactiva) | ModalRegistrarIngreso en AforoPage (R,G), con `socioId` + TOTP | ROLES R, G | R: `body.sedeId == sedeId` JWT | **D5**: el JWT dice que `socioId` viaja "para que la app lo mande en POST /ingresos"; ¿lo llama la app del socio o un puesto de control? El front solo lo usa R,G |
| POST /ingresos/{ingresoId}/egreso (`registrarEgreso`) | Jwt+Roles(R,G); 403 si otra sede | "personas dentro" (R,G) | Sin cambios | R solo su sede | — |
| POST /sincronizacion/ingresos (`sincronizarIngresos`) | Jwt+Roles(R); sede del JWT | useSincronizacionOffline (R) | Sin cambios | Sede del JWT | — |

### m3 · clases (`clases`, `reservas-clases`, `esperas-clases`)
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| POST /clases (`crearClase`) | ✗ | Agenda → ModalNuevaClase (R,G) | ROLES R, G | R: `body.sedeId` == su sede (la UI ya la fija) | D7 |
| GET /clases (`listarClases`) | ✗ | Agenda (S,R,G) | SESIÓN | — | D8: el caso de uso UC-02 dice "Socio / Visitante": ¿agenda pública? El front la exige con sesión |
| GET /clases/{claseId} (`obtenerClase`) | ✗ | Detalle (S,R,G) | SESIÓN | — | idem D8 |
| GET /clases/{claseId}/reservas (`listarReservasDeClase`) | ✗ | Detalle, inscriptos (R,G) | ROLES R, G | Expone `socioId` ajenos | S nunca lo pide |
| GET /clases/{claseId}/espera (`listarEsperaDeClase`) | ✗ | Detalle y "mis clases": R,G ven la cola; **S la pide entera para calcular su posición** | SESIÓN (provisorio) | Ve `socioId` ajenos (sin nombres) | **Conflicto**: ROLES R,G rompe el lugar en la cola del S. D9 |
| POST /reservas-clases (`crearReservaClase`) | ✗ | Detalle de clase (S) | DUEÑO | S: `body.socioId == socioId` JWT; E → 403 (no tiene socio) | D10: R,G pueden por regla, pero ninguna pantalla los deja |
| GET /reservas-clases (`listarReservasClase`) | ✗ | Marcas de la agenda y "mis clases" (S, con su `socioId`) | DUEÑO | S: se fuerza `socioId` del token; R,G todo | Restringir R por sede exige join con la clase (D3) |
| GET /reservas-clases/{id} (`obtenerReservaClase`) | ✗ | Ninguna pantalla | DUEÑO | S: `reserva.socioId` == token (404) | — |
| POST /reservas-clases/{id}/cancelaciones (`cancelarReservaClase`) | ✗ | Detalle y "mis clases" (S) | DUEÑO | S: `reserva.socioId` == token | Con <2 h cobra penalidad (flujo interno) |
| POST /clases/{claseId}/espera (`anotarseEnEspera`) | ✗ | Detalle (S) | DUEÑO | S: `body.socioId` == token | Mismo caso que crearReserva |
| GET /esperas-clases (`listarEsperasClase`) | ✗ | Marcas y "mis clases" (S, con `socioId`) | DUEÑO | S: se fuerza `socioId`; R,G todo | — |
| GET /esperas-clases/{id} (`obtenerEspera`) | ✗ | Ninguna pantalla | DUEÑO | `espera.socioId` == token | — |
| DELETE /esperas-clases/{id} (`salirDeEspera`) | ✗ | Detalle y "mis clases" (S) | DUEÑO | idem | — |
| POST /esperas-clases/{id}/confirmaciones (`confirmarEspera`) | ✗ | Detalle y "mis clases" (S) | DUEÑO | idem | — |

### m4 · canchas (`canchas`, `reservas-canchas`)
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| GET /sedes/{sedeId}/canchas (`listarCanchas`) | ✗ | Ninguna (el front usa `GET /canchas`) | SESIÓN | — | — |
| POST /sedes/{sedeId}/canchas (`crearCancha`) | ✗ | `/canchas` → ModalNuevaCancha (solo G) | ROLES G | — | D11: ¿también R? |
| GET /canchas (`buscarCanchas`) | ✗ | `/canchas`, etiquetas de "mis reservas" (S,E,R,G) | SESIÓN | — | — |
| GET /canchas/{canchaId} (`obtenerCancha`) | ✗ | Grilla de turnos (S,E,R,G) | SESIÓN | — | — |
| PATCH /canchas/{canchaId} (`modificarCancha`) | ✗ | ModalEditarCancha (solo G) | ROLES G | — | D11 |
| GET /canchas/{canchaId}/disponibilidad (`consultarDisponibilidad`) | ✗ | Grilla (S,E,R,G) | SESIÓN | No expone reservantes (`fechaHoraInicio`, `fechaHoraFin`, `disponible`) | — |
| GET /reservas-canchas (`listarReservasCancha`) | ✗ | S,E: "mis reservas" con su `usuarioId`; R,G: reservas del día de una cancha (nombres de reservantes) | DUEÑO | S/E: se fuerza `usuarioId` del token; R,G todo | R por sede exige join con la cancha (D3) |
| POST /reservas-canchas (`crearReservaCancha`) | ✗ | Grilla (S,E) | DUEÑO | S/E: `body.usuarioId == userId`; R,G todo | **D10**: la UI define "reservar es de quien juega (S,E)"; R,G quedarían habilitados sin pantalla |
| GET /reservas-canchas/{id} (`obtenerReservaCancha`) | ✗ | `/pagos/nuevo` (S,E) | DUEÑO | `reserva.usuarioId == userId` (404) | — |
| POST /reservas-canchas/{id}/cancelaciones (`cancelarReservaCancha`) | ✗ | "mis reservas" (S,E) | DUEÑO | idem | Dispara el listener de M5 |

### m5 · pagos y reportes
| Método y ruta | Protección hoy | Quién lo llama (front) | Propuesta | Dueño o sede | Conflicto o duda |
|---|---|---|---|---|---|
| POST /pagos, GET /pagos, GET /pagos/{id}, GET /pagos/{id}/comprobante | Jwt+Roles de clase; alcance en `PagosAccesoService`; contrato OK | `/mis-pagos`, `/pagos/nuevo` (S,E); `/pagos` (R,G) | Sin cambios | S/E solo lo propio (404); R,G todo; sin sede | — |
| POST /pagos/{id}/anulaciones | Roles(R,G); contrato 401/403 | `/pagos` (R,G) | Sin cambios | — | — |
| GET /reportes/pagos | Jwt+Roles(G); contrato 401/403 | `/reportes/ingresos` (G) | Sin cambios | — | — |

## 3. Endpoints propuestos como públicos
1. `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (los únicos sin sesión que usa el front).
2. **Ningún otro por defecto.** Quedan a decisión (D5, D8): `POST /ingresos` (si hay un puesto sin operador: hoy valida socio + TOTP de 6 dígitos y no hay throttling ni límite de intentos), `GET /sedes/{id}/aforo` (solo un número) y `GET /clases` (UC-02 "Visitante").

## 4. Tests que van a necesitar sesión
Helpers existentes (`test/helpers/sesion.ts`): `iniciarSesion(app, prisma, usuarioId)` (login real por HTTP, pone hash válido a un usuario creado por Prisma), `crearUsuarioConSesion(app, prisma, rol, prefijo)` y `conToken(token)`. `m5.fixtures.ts` ya ofrece sesión por rol (`crearContextoM5`). **Todo lo necesario ya existe**: faltaría, a lo sumo, un helper que dé el token de un SOCIO con `socioId` (basta `iniciarSesion` sobre el usuario del socio) y uno de RECEPCION con sede (hoy `sedes-ingresos.e2e` y `auth.e2e` arman el suyo con `POST /usuarios` + `login`). Los fixtures de M3 (`socioId` y `usuarioId`) y M4 (`usuarioId`) crean los usuarios por Prisma con hash de relleno: se resuelve con `iniciarSesion`.

El guard corre antes que la validación: los tests de 400/422 sin token pasarían a dar 401.

| Módulo | Archivos y llamadas hoy sin token |
|---|---|
| m1 | `m1-usuarios/usuarios.e2e` (19: `POST /usuarios` ×16, GET/PATCH), `socios.e2e` (10; ya usa sesión G para el comprobante), `cobro-interno.e2e` (9: socios, membresías, usuarios), `errores/dominio.e2e` (10) y `errores/framework-4xx.e2e` (`POST /socios` con cuerpo inválido y `GET /socios/abc`: pasan a 401 salvo que lleven token) |
| m2 | `m2-gimnasio/sedes-ingresos.e2e` (`POST /sedes`, `POST /usuarios`, `GET aforo` ×2, `POST /ingresos`); `auth.e2e` (`POST /ingresos` ×3 sin token, con TOTP, líneas ~158, 164, 196) |
| m3 | `clases.e2e` (6), `concurrencia.e2e` (9), `espera.e2e` (14), `listados.e2e` (5), `reservas.e2e` (10; 4 con sesión) |
| m4 | `canchas.e2e` (11), `disponibilidad.e2e` (8), `reservas.e2e` (6) |
| m5 / reportes / auth | Ya con sesión (`pagos`, `pagos-acceso`, `comprobante`, `reportes`) o públicos (`sesion.e2e`: login/refresh/logout) |

Integración (`*.integration-spec.ts`) y unitarios llaman a los servicios, no a HTTP: no se afectan. Único spec de controller: `auth.controller.spec.ts`.

## 5. Cableado de los guards
- `JwtAuthGuard` (extiende `AuthGuard('jwt')`) necesita `AuthModuleOptions` de `PassportModule`, que **`CommonsModule`** registra y exporta. La `JwtStrategy` vive en `AuthModule` y se registra global en passport.
- **Todos los módulos ya importan `CommonsModule`** (auth, usuarios, gimnasio, clases, canchas, pagos, reportes): no hay que tocar imports para cerrar controllers. Cada controller solo importa `JwtAuthGuard`, `RolesGuard` y `Roles` desde `commons/guards`.
- `RolesGuard` solo necesita `Reflector`. Sin `@Roles` deja pasar (sesión alcanza). El 401 sale de `JwtAuthGuard` y el 403 de `RolesGuard` con "No tiene permisos para acceder a este recurso.".
- Patrón de alcance: función pura (`alcance-pagos.ts`) + `*AccesoService` por módulo que delega en el servicio real, sin tocar el servicio interno.

### Guard global con `@Public()`
> **Hecho (paso 4):** `JwtAuthGuard` y `RolesGuard` son `APP_GUARD` en `AppModule`; `@Public()` marca `login`, `refresh` y `logout`; los controllers ya no llevan `@UseGuards`; el contrato quedó con `security: [{ bearer: [] }]` global. Ver `backend/README.md`. Lo que sigue es el análisis previo.

- Hoy no existe nada parecido (ni `APP_GUARD`, ni `IS_PUBLIC_KEY`).
- Es viable: `APP_GUARD` en `AppModule` con `JwtAuthGuard` ampliado (lee `IS_PUBLIC_KEY` con `Reflector`; hoy no tiene dependencias) y luego `RolesGuard` (el orden de providers fija el orden de ejecución). Las rutas inexistentes siguen dando 404, porque el guard solo corre con ruta resuelta (lo cubre `framework-4xx`).
- Excepciones: `login`, `refresh`, `logout` y las que resuelvan D5 y D8.
- Obligaría a invertir el contrato (`security: [{bearer: []}]` global y `security: []` en las públicas) y a regenerar `frontend/src/types/api.d.ts`.
- **Recomendación:** cerrar módulo por módulo con guards explícitos (el pedido actual) y sumar el global al final como red de seguridad, para que un controller nuevo no quede abierto por olvido. Hacerlo primero cerraría todo de golpe y rompería los tests de los módulos aún sin migrar.

## 6. Flujos internos que no deben cambiar (no pasan por controllers)
- Crons de medianoche: `RenovacionesCron` (M5) y `MembresiasCron` (M1).
- Listeners M5: `RenovacionesListener` (`EVENTO_SOCIO_ALTA`, `EVENTO_MEMBRESIA_PLAN`), `PenalidadReservaClaseListener` (cancelación tardía de clase), `ReservaCanceladaListener` (cancelación de cancha).
- Observers M3 de `EVENTO_CUPO_LIBERADO`: mail y notificación a la espera.
- Cobros internos: `CobroInternoService` y `PagosService`, usados sin actor (alta de socio y cambio de plan emiten `emitAsync` desde M1). `PagosAccesoService` ya los dejó intactos; los servicios de precio solo exponen datos.
- Los guards viven en controllers: nada de esto se ve afectado. Cuidado: al agregar `*AccesoService` no hay que inyectar el actor en los servicios que usan estos flujos.

## 7. Orden de implementación sugerido
| # | Módulo | Riesgo (pantallas que podrían dejar de andar) |
|---|---|---|
| 1 | m2 sedes + `POST /ingresos`, `GET /ingresos/{id}`, aforo | Bajo si es ROLES R,G / SESIÓN. Antes hay que resolver D5. `GET /sedes` en SESIÓN no rompe a nadie |
| 2 | m4 canchas (6 endpoints) | Bajo: SESIÓN para lectura y ROLES G para alta/edición coinciden con la UI. Falla si R edita canchas hoy (D11) |
| 3 | m1 membresías y socios | Medio: el Carnet (S) lee `GET /socios/{id}` y `/membresias` y `GET /usuarios/{id}`: sin DUEÑO correcto el Carnet queda vacío |
| 4 | m1 usuarios | Medio-alto: `GET /usuarios/{id}` lo llama el armazón de **todos** los roles; E también (nombre y email del encabezado) |
| 5 | m3 reservas y esperas | Medio: S depende de `GET /clases/{id}/espera` completa (D9) y de `socioId` en el token (si no hay `socioId` → 403/404 al reservar) |
| 6 | m4 reservas | Medio: la grilla (R,G) lista reservas ajenas por cancha y día; DUEÑO no debe filtrar a R,G. S,E: forzar `usuarioId` |
| 7 | Guard global + `@Public()` + contrato `security` | Bajo, pero toca contrato y `api.d.ts` |

## 8. Dudas para decidir
- **D1** ¿Quién puede crear usuarios RECEPCION/GERENTE y quién puede dar de baja un socio: R y G o solo G? El código y los docs no lo dicen; el front deja a G crear personal.
- **D2** ¿R puede cambiar datos y contraseña de un usuario GERENTE o RECEPCION (`PATCH /usuarios/{id}`)? Propuesta: R solo sobre S y E.
- **D3** ¿R ve y gestiona todos los socios y reservas o solo los de su sede? El `sedeId` está en el JWT, pero el docs describe el acceso como multi-sede y la sede de origen como informativa. Propuesta: sin restricción por sede salvo ingresos, aforo y creación de clases.
- **D4** ¿S puede frenar su propia renovación automática (`PATCH` membresía)? Hoy ninguna pantalla se lo muestra.
- **D5** ¿Quién llama a `POST /ingresos`: el puesto de control atendido por R/G (lo que hace el front) o la app del socio (lo que sugiere el comentario del JWT)? Y ¿`aforo` es público? Si hay un kiosco sin sesión, hace falta throttling antes de abrir el endpoint.
- **D6** Para ingreso de otra sede: ¿404 como pagos o 403 como el egreso actual?
- **D7** ¿R puede crear clases solo en su sede? Propuesta: sí, 403 si es otra.
- **D8** ¿La agenda de clases (`GET /clases`) es pública para "visitantes" (UC-02)? Propuesta: SESIÓN, como el front. Además, E hoy no tiene pantalla de clases: ¿debería poder verlas?
- **D9** Para la posición en la cola de espera: ¿se acepta que S vea `socioId` ajenos (propuesta provisoria SESIÓN) o se agrega un campo "posición" al contrato (fuera de este alcance)?
- **D10** ¿R y G pueden reservar canchas o clases por un socio? Las pantallas no lo permiten; la propuesta ("R,G todo") es la regla que usaste en pagos.
- **D11** ¿R puede crear/editar canchas? La UI solo se lo deja a G.
- **D12** (menor) `frontend/README.md` dice que E arranca en `/inicio`, pero `acceso.ts` lo manda a `/canchas`.
