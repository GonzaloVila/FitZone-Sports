# Feature Clases (`features/clases`)

Módulo de Clases grupales (M3): agenda (RF-06), reserva y cancelación (RF-07) y lista de espera (RF-08).

## Estructura de carpetas

```text
src/features/clases/
├── components/
│   ├── AccionesClase.vue        # Decide el botón (reservar, cancelar, anotarse, confirmar) o el motivo
│   ├── FiltrosClases.vue        # Filtros por disciplina y sede
│   ├── FormularioClase.vue      # Campos de ClaseIn
│   ├── ListaEsperaClase.vue     # Cola de espera (RECEPCION / GERENTE)
│   ├── ListaInscriptos.vue      # Ocupación de la clase (RECEPCION / GERENTE)
│   ├── ModalCancelarClase.vue   # Confirmación con aviso de penalidad (usa ModalFz)
│   ├── TablaClases.vue          # Agenda con cupos libres y estado
│   ├── TablaMisEsperas.vue      # Esperas del socio con posición y acciones
│   └── TablaMisReservas.vue     # Reservas del socio (próximas / pasadas)
├── composables/
│   ├── useAgendaClases.ts       # Filtros, página, descarte de respuestas viejas
│   ├── useAltaClase.ts          # Validación de ayuda de uso y traducción del 409 de horario
│   ├── useDetalleClase.ts       # Clase, reserva y espera del socio, acciones, actualización periódica
│   └── useMisClases.ts          # Reservas y esperas del socio logueado, actualización periódica
├── pages/
│   ├── AgendaClasesPage.vue     # /clases
│   ├── AltaClasePage.vue        # /clases/nueva
│   ├── DetalleClasePage.vue     # /clases/:claseId
│   └── MisClasesPage.vue        # /mis-clases
├── services/
│   └── servicioClases.ts        # Clases, reservas de clase y esperas contra api.d.ts
├── errores.ts                   # Traducción de errores por el campo `type` del problem+json
├── presentacion.ts              # Etiquetas, variantes y formato de fechas
├── reglas.ts                    # Ventana de 48 hs y penalidad de 2 hs
├── rutas.ts
└── tipos.ts
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/clases` | `clases` | SOCIO, RECEPCION, GERENTE | "Clases" (orden 4) |
| `/clases/nueva` | `clases-nueva` | RECEPCION, GERENTE | — |
| `/clases/:claseId` | `clase-detalle` | SOCIO, RECEPCION, GERENTE | — |
| `/mis-clases` | `mis-clases` | SOCIO | "Mis clases" (orden 5) |

## Decisiones y reglas

1. **Arquitectura:** página → composable → servicio → cliente tipado. Las páginas solo componen. El servicio se pide con `useServicios().clases`.
2. **El servidor decide.** Las reglas de `reglas.ts` solo anticipan el motivo en pantalla (ventana de 48 hs, clase comenzada, penalidad). Si el servidor responde 409 se muestra el mismo motivo.
3. **Errores por `type`:** `errores.ts` distingue los 409 (`reserva-anticipada-no-permitida`, `clase-pasada`, `cupo-agotado`, `reserva-duplicada`, `cupo-disponible`, `espera-existente`, `espera-confirmada`, `espera-no-notificada`, `cupo-tomado`). 403 es cuota vencida y 402 es penalidad rechazada.
4. **Cupos en tiempo real:** después de reservar, cancelar, anotarse, confirmar o salir se vuelve a pedir la clase.
5. **Lista de espera:** el servidor marca `NOTIFICADO`; el front lo ve porque el detalle y "Mis clases" se actualizan cada 5 s (`useActualizacionPeriodica`, se corta al salir). "Confirmar cupo" solo aparece en `NOTIFICADO`.
6. **Socio de la sesión:** `useUsuarioSesion().socioId`. RECEPCION usa su `sedeId` como sede por defecto; el GERENTE elige.
7. **Estado "cumplida":** lo calcula el servidor y el front lo muestra tal cual.
8. **Limitaciones del contrato:** `GET /clases` no filtra por fecha (la agenda es el listado paginado) y las reservas y esperas no traen el nombre del socio (se muestra "Socio #id").
9. **Kit:** se agregó `PestanasFz` (`ui/moleculas`) y `CampoTextoFz` acepta `tipo="time"`.
10. **Accesibilidad:** foco visible, etiquetas en todos los campos, errores asociados con `aria-describedby`, tablas con título, pestañas con teclado.
