# Feature Clases (`features/clases`)

Módulo de Clases grupales (M3): agenda (RF-06), reserva y cancelación (RF-07) y lista de espera (RF-08).

## Estructura de carpetas

```text
src/features/clases/
├── components/
│   ├── modales/
│   │   └── ModalNuevaClase.vue  # Alta de clase: encabezado, pie, errores internos y aviso de éxito
│   ├── AccionesClase.vue        # Decide el botón (reservar, cancelar, anotarse, confirmar) o el motivo
│   ├── DatosClase.vue           # Instructor, sede, cupos y reservas en filas "etiqueta … valor"
│   ├── FilaDatoClase.vue        # Una fila de DatosClase
│   ├── FiltrosClases.vue        # Filtros en fila: disciplina y sede
│   ├── FormularioClase.vue      # Solo los campos de ClaseIn (el modal pone el resto)
│   ├── ListaEsperaClase.vue     # Cola de espera (RECEPCION / GERENTE)
│   ├── ListaInscriptos.vue      # Ocupación de la clase (RECEPCION / GERENTE)
│   ├── ModalCancelarClase.vue   # Confirmación con aviso de penalidad (usa ModalFz)
│   ├── TablaClases.vue          # Agenda con cupos libres y estado
│   ├── TablaMisEsperas.vue      # Esperas del socio con posición y acciones
│   └── TablaMisReservas.vue     # Reservas del socio (próximas / pasadas)
├── composables/
│   ├── useAgendaClases.ts       # Filtros, página, sede inicial, descarte de respuestas viejas
│   ├── useAltaClase.ts          # Validación de ayuda de uso, sede por defecto y traducción del 409 de horario
│   ├── useDetalleClase.ts       # Clase, reserva y espera del socio, acciones, actualización periódica
│   └── useMisClases.ts          # Reservas y esperas del socio logueado, actualización periódica
├── pages/
│   ├── AgendaClasesPage.vue     # /clases
│   ├── DetalleClasePage.vue     # /clases/:claseId
│   └── MisClasesPage.vue        # /mis-clases
├── services/
│   └── servicioClases.ts        # Clases, reservas de clase y esperas contra api.d.ts
├── errores.ts                   # Traducción de errores por el campo `type` del problem+json
├── presentacion.ts              # Etiquetas, variantes, estado de la clase y formato de fechas
├── reglas.ts                    # Ventana de 48 hs y penalidad de 2 hs
├── rutas.ts
└── tipos.ts
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/clases` | `clases` | SOCIO, RECEPCION, GERENTE | "Clases" (orden 4) |
| `/clases/:claseId` | `clase-detalle` | SOCIO, RECEPCION, GERENTE | — (queda activo "Clases") |
| `/mis-clases` | `mis-clases` | SOCIO | "Mis clases" (orden 5) |

## Decisiones y reglas

1. **Arquitectura:** página → composable → servicio → cliente tipado. Las páginas solo componen. El servicio se pide con `useServicios().clases`.
2. **El servidor decide.** Las reglas de `reglas.ts` solo anticipan el motivo en pantalla (ventana de 48 hs, clase comenzada, penalidad). Si el servidor responde 409 se muestra el mismo motivo.
3. **Errores por `type`:** `errores.ts` distingue los 409 (`reserva-anticipada-no-permitida`, `clase-pasada`, `cupo-agotado`, `reserva-duplicada`, `cupo-disponible`, `espera-existente`, `espera-confirmada`, `espera-no-notificada`, `cupo-tomado`). 403 es cuota vencida y 402 es penalidad rechazada.
4. **Cupos en tiempo real:** después de reservar, cancelar, anotarse, confirmar o salir se vuelve a pedir la clase.
5. **Lista de espera:** el servidor marca `NOTIFICADO`; el front lo ve porque el detalle y "Mis clases" se actualizan cada 5 s (`useActualizacionPeriodica`, se corta al salir). "Confirmar cupo" solo aparece en `NOTIFICADO`.
6. **Socio de la sesión:** `useUsuarioSesion().socioId`. RECEPCION usa su `sedeId`; el GERENTE elige.
7. **Estado "cumplida":** lo calcula el servidor y el front lo muestra tal cual.
8. **Limitaciones del contrato:** `GET /clases` no filtra por fecha (la agenda es el listado paginado) y las reservas y esperas no traen el nombre del socio (se muestra "Socio #id").
9. **Kit:** se usa `PestanasFz` (reservas próximas / pasadas) y `CampoTextoFz` acepta `tipo="time"`.
10. **Accesibilidad:** foco visible, etiquetas en todos los campos, errores asociados con `aria-describedby`, tablas con título, pestañas con teclado.
11. **Penalidad (RF-07):** si la cancelación es tardía, después del 204 se busca el pago de la reserva (`GET /pagos?reservaClaseId=`) y se muestra el importe con el botón de comprobante, que reusa `useDescargaPdf` de M5.
12. **Después de cancelar:** el detalle ya no ofrece "Reservar"; queda el enlace "Volver a la agenda" del encabezado (más el comprobante de la penalidad si hubo). Para reservar de nuevo hay que rehacer el recorrido: `reservaCancelada` se resetea al cambiar de clase.
13. **Sede activa:** la comparte `compartido/composables/useSedeActiva` con Acceso. El filtro de sede de la agenda arranca ahí para RECEPCION y GERENTE (el RECEPCION, en la suya; el SOCIO ve todas las sedes) y se aplica una sola vez, aunque las sedes lleguen después. El filtro sigue teniendo "Todas las sedes" y no cambia la sede activa.
14. **Nueva clase en un modal:** se abre desde la agenda (RECEPCION y GERENTE), arranca con la sede activa y el RECEPCION no puede cambiarla. Si el servidor rechaza la clase, el error se muestra dentro del modal (el 409 de horario, junto a los campos de horario). Al crearla se cierra, avisa "Clase creada" y recarga la agenda. Ya no existe la ruta `/clases/nueva`.
15. **Estado de la clase:** `estadoDeClase` (comenzada, sin cupos, con cupos) lo usan la tabla de la agenda y el encabezado del detalle.
