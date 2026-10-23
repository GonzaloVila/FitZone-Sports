# Feature Acceso (`features/acceso`)

Módulo de Gimnasio y Acceso (M2), responsable de la gestión de aforo, control de ingresos y egresos, historial de accesos y sincronización offline.

## Estructura de carpetas

```text
src/features/acceso/
├── components/
│   ├── FiltrosHistorial.vue        # Filtros de búsqueda (fecha, nombre, socio, sede)
│   ├── FormularioIngreso.vue       # Formulario con socioId y código TOTP/QR
│   ├── ResultadoIngreso.vue        # Notificación con alto contraste, texto e íconos
│   ├── TablaHistorial.vue          # Tabla paginada de accesos con Insignias de estado
│   ├── TablaPersonasDentro.vue     # Socios actualmente en la sede con botón de egreso
│   └── TarjetaAforo.vue            # Resumen de aforo con medidor y aviso persistente
├── composables/
│   ├── useAforo.ts                 # Aforo en tiempo real con actualización periódica (10s)
│   ├── useHistorialAccesos.ts      # Consulta paginada con debounce y descarte de respuestas viejas
│   ├── usePersonasDentro.ts        # Consulta de ingresos abiertos y acción de egreso
│   ├── useRegistroIngreso.ts       # Envío y traducción de errores según RFC 9457 problem+json
│   └── useSincronizacionOffline.ts # Cola offline y sincronización en lote (RNF-01)
├── pages/
│   ├── AforoPage.vue               # /acceso/aforo (RECEPCION / GERENTE)
│   ├── HistorialAccesosPage.vue    # /acceso/historial (RECEPCION / GERENTE)
│   └── RegistrarIngresoPage.vue    # /acceso/ingreso (RECEPCION / GERENTE)
├── services/
│   └── servicioAcceso.ts           # Cliente tipado contra api.d.ts para /ingresos y /sedes/{id}/aforo
├── rutas.ts                        # Definición de rutas y metadatos de navegación
└── tipos.ts                        # Constantes de tipos de error del contrato
```

## Rutas

| Ruta | Nombre | Roles | Descripción |
|---|---|---|---|
| `/acceso/aforo` | `acceso-aforo` | RECEPCION, GERENTE | Monitor de ocupación en tiempo real y lista de personas dentro con egreso. Entrada única "Acceso" en el menú. |
| `/acceso/ingreso` | `acceso-ingreso` | RECEPCION, GERENTE | Formulario de validación de código TOTP/QR y socio. |
| `/acceso/historial` | `acceso-historial` | RECEPCION, GERENTE | Historial paginado con filtros de fecha, sede y búsqueda de socio. |

## Decisiones técnicas y reglas de negocio

1. **Fuente de verdad (`api.d.ts`)**: Se consumen estrictamente los tipos y esquemas generados desde OpenAPI (`AforoOut`, `IngresoIn`, `IngresoOut`, `ListaIngresos`, etc.).
2. **Diferenciación de errores RFC 9457**:
   - `409` con `type: 'https://fitzone.app/errores/acceso-duplicado'` -> RN-01: socio ya dentro de una sede.
   - `409` con `type: 'https://fitzone.app/errores/aforo-lleno'` -> RF-05: aforo máximo de la sede alcanzado.
   - `403` con `type: 'https://fitzone.app/errores/membresia-inactiva'` -> RF-04: membresía no vigente o suspendida.
   - `409` con `type: 'https://fitzone.app/errores/egreso-duplicado'` -> Ingreso ya egresado (refresca automáticamente la lista de personas dentro).
3. **Seguridad y privacidad**: El código TOTP se limpia inmediatamente del formulario y nunca se persiste ni se imprime en logs.
4. **Actualización periódica**: Implementada con el composable compartido `useActualizacionPeriodica` (cada 10 segundos). Se suspende automáticamente cuando la pestaña está oculta (`document.visibilityState === 'hidden'`) para no generar tráfico ocioso.
5. **Accesibilidad WCAG 2.2 AA**:
   - Componente `MedidorFz` utilizando el elemento nativo `<meter>` con atributos ARIA completos (`aria-valuenow`, `aria-valuetext`).
   - Los mensajes de resultado y rechazos emplean íconos y textos explicativos explícitos, no dependiendo exclusivamente de colores.
