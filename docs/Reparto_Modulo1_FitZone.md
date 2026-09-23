## FitZone Sports — Reparto de tareas: Módulo 1 (Usuarios / Socios / Membresías)

TFI · Programación V · Sprint 2 (Unidad II) · SCRUM-11c, lotes L1 y L4 · Contrato base: TFI FitZone - OpenAPI.yaml (versión final)

El plan de Sprint 2 vigente asigna todo el Módulo 1 (lotes L1 y L4) a una sola persona. Esta propuesta lo reorganiza en 5 bloques para que los 4 integrantes puedan trabajar en paralelo, cada uno sobre archivos propios dentro de modules/m1-usuarios/, minimizando bloqueos y conflictos de merge. El Bloque 0 aplica el mismo principio del Design-First que ya usaron para la API completa, pero a nivel de código: se acuerda primero la interfaz del repositorio (el contrato entre capas), así los Bloques 1-3 arrancan sin esperar a que la implementación real con Prisma esté terminada.

## Resumen de los 5 bloques

| Bloque | Alcance | Responsable sugerido Depende de |   | Cuándo puede arrancar |
| --- | --- | --- | --- | --- |
| Bloque 0 | Contrato del repositorio de M1 (interfaces + | Backend con más | Nada — es lo primero | Se resuelve en horas, no días: son firmas, no |
|   | tokens DI, sin implementación) | experiencia en NestJS |   | lógica |
|   |   | (ref. Exequiel) |   |   |
| Bloque 1 | Usuarios — POST / GET / PATCH /usuarios | Sugerido: Exequiel | Bloque 0 | Apenas el Bloque 0 tenga la interfaz de |
|   |   |   |   | UsuarioRepository |
| Bloque 2 | Socios — POST / GET / PATCH / DELETE | Sugerido: Santiago | Bloque 0 (+ mock de | En paralelo al Bloque 1, usando un mock hasta |
|   | /socios |   | UsuarioRepository) | que exista la implementación real |
| Bloque 3 | Membresías — POST / GET | Sugerido: Santino | Bloque 0 (+ mock de | En paralelo a los Bloques 1 y 2, con mock de |
|   | /socios/{id}/membresias |   | SocioRepository) | Socios |
| Bloque 4 | Swagger consolidado de M1 + test e2e del flujo | Sugerido: Gonzalo | Bloques 1, 2 y 3 ya mergeados | Arranca preparando los casos de test contra el |
|   | completo |   |   | contrato; corre en serio al final |

## Bloque 0 — Contrato del repositorio (fundacional)

Define solo las firmas (interfaz + InjectionToken), sin lógica: es la referencia que van a replicar M2, M3 y M4 más adelante, tal como ya está previsto en el plan de Sprint 2 (microtarea 4).

| Archivo | Contenido |
| --- | --- |
| modules/m1-usuarios/repositories/usuario.repository.t | Interfaz UsuarioRepository (crear, buscarPorId, buscarPorDniOEmail, actualizar) + InjectionToken |
| s |   |
| modules/m1-usuarios/repositories/socio.repository.ts | Interfaz SocioRepository (crear, buscarPorId, actualizar, eliminar) + InjectionToken |
| modules/m1-usuarios/repositories/membresia.reposito | Interfaz MembresiaRepository (crear, buscarPorSocioId) + InjectionToken |
| ry.ts |   |

## Bloque 1 — Usuarios (L1)


Reglas clave: dni y email únicos (409 si ya existen) · contrasenia se hashea con bcrypt y nunca se devuelve (campo writeOnly) · el rol al crear se limita a EXTERNO | RECEPCION | GERENTE — SOCIO no se asigna acá, eso ocurre por POST /socios (Bloque 2).

| Endpoint | Archivos principales | Regla de negocio / detalle | Respuestas |
| --- | --- | --- | --- |
| POST /usuarios | dtos/crear-usuario.dto.ts · | Valida unicidad dni/email · hashea contrasenia · | 201 + Location · 400 · 409 · 422 |
|   | repositories/prisma/prisma-usuario.repository.ts | arma UsuarioOut |   |
|   | · services/usuarios.service.ts · |   |   |
|   | controllers/usuarios.controller.ts |   |   |
| GET /usuarios/{id} | (mismo controller/service que arriba) | Devuelve UsuarioOut sin datos de contraseña | 200 · 404 |
| PATCH /usuarios/{id} | dtos/modificar-usuario.dto.ts | Actualiza solo campos presentes (nombre, | 200 · 404 · 422 |
|   |   | telefono, foto_url, contrasenia) · rehashea si |   |
|   |   | viene contrasenia |   |

## Bloque 2 — Socios (parte de L4)

Reglas clave (RF-01/RF-02): convierte un usuario existente en socio · si el usuario ya es socio, 409 · si al crear se envía plan, la membresía inicial se crea en la misma transacción · el DELETE no es una baja física de historial: borra la fila Socio (y su membresía 1:1) y el usuario vuelve a rol EXTERNO; pagos y reservas siguen referenciando al usuario, no a la subtabla.

| Endpoint | Archivos principales | Regla de negocio / detalle | Respuestas |
| --- | --- | --- | --- |
| POST /socios | dtos/crear-socio.dto.ts · | Verifica que usuario_id exista (404) y no sea ya | 201 + Location · 404 · 409 · 422 |
|   | repositories/prisma/prisma-socio.repository.ts · | socio (409) · si viene plan, crea Socio + |   |
|   | services/socios.service.ts · | Membresia en una transacción |   |
|   | controllers/socios.controller.ts |   |   |
| GET /socios/{socioId} | (mismo controller/service que arriba) | Devuelve SocioOut (usuario_id, | 200 · 404 |
|   |   | sede_origen_id, fecha_alta) |   |
| PATCH /socios/{socioId} | dtos/modificar-socio.dto.ts | Actualiza sede_origen_id | 200 · 404 · 422 |
| DELETE /socios/{socioId} | (mismo controller/service que arriba) | Elimina Socio + Membresía (1:1) · usuario | 204 · 404 |
|   |   | vuelve a rol EXTERNO · no toca historial de |   |
|   |   | reservas/pagos |   |

## Bloque 3 — Membresías (resto de L4)

Reglas clave: relación 1:1 con el socio, sin historial — un segundo POST sobre un socio con membresía responde 409 · fecha_fin se calcula a partir de fecha_inicio (por defecto hoy) según el plan (MENSUAL = +1 mes · TRIMESTRAL = +3 meses · ANUAL = +1 año) · renueva_automatica dispara el cobro más adelante vía Mediador M5 (fuera de alcance de este bloque, ya documentado en el ADR-01).


| Endpoint | Archivos principales | Regla de negocio / detalle | Respuestas |
| --- | --- | --- | --- |
| POST /socios/{socioId}/membresias | dtos/crear-membresia.dto.ts · repositories/pris | 409 si el socio ya tiene membresía · calcula | 201 + Location · 404 · 409 · 422 |
|   | ma/prisma-membresia.repository.ts · | fecha_fin según el plan |   |
|   | services/membresias.service.ts · |   |   |
|   | controllers/membresias.controller.ts |   |   |
| GET /socios/{socioId}/membresias | (mismo controller/service que arriba) | Devuelve la membresía vigente | 200 · 404 |
|   |   | (MembresiaOut) del socio |   |

## Bloque 4 — Swagger consolidado + test e2e de M1

No agrega endpoints nuevos: revisa que los 9 endpoints de M1 queden documentados y coherentes en /docs (tags usuarios/socios/membresias, ejemplos, problem+json) y escribe el test e2e de flujo completo con supertest: crear usuario hacerse socio con plan consultar membresía dejar de ser socio (verificar que vuelve a EXTERNO). Puede arrancar en paralelo preparando los casos de prueba contra el contrato OpenAPI ya congelado, pero solo corre en serio una vez que los Bloques 1-3 estén mergeados a main.

## Orden de integración a main y Definición de Terminado

Merge: Bloque 0 primero (PR chico y rápido) · después Bloques 1, 2 y 3 pueden entrar en cualquier orden, reemplazando en cada service el mock del repositorio del que dependían por la inyección real cuando esté disponible · Bloque 4 al final. Cada bloque es un PR propio revisado por 1 integrante, igual que ya lo vienen haciendo.

DoD del Módulo 1: los 9 endpoints responden según el contrato (incluidos los códigos 404/409/422) · contrasenia nunca viaja en una respuesta · la transacción socio+membresía inicial es atómica · el DELETE de socio preserva historial de pagos/reservas · Swagger en /docs documenta M1 completo · test e2e del flujo usuario→socio→membresía en verde · LOG.md actualizado por cada integrante con su commit real.

Ojo, dato importante para más adelante: la versión final del contrato cambió los identificadores de UUID a enteros (id numérico autoincremental) respecto de una versión anterior del YAML. Si en Semana 10 se retoma la capa de servicios del frontend, conviene regenerar schema.d.ts contra este contrato actualizado antes de tipar nada — los tipos generados hoy para reservas/pagos ya no coinciden con este esquema.
