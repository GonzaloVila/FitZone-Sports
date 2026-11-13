# Diagramas - FitZone Sports (Unidad III: Patrones)

Generados a partir del **código real** del repo `FitZone-Sports/backend`.

## Como verlos

- **`html/`** - diagramas **interactivos** standalone (tema claro/oscuro, zoom, pan, busqueda, foco, trazado y export a PNG/SVG). Abrir en cualquier navegador.
- **`png/`** - imagenes **listas para pegar** en el TP (2048x1320; UML a 2x).
- **`specs/`** - fuente editable de los diagramas de comportamiento (JSON de archify).
- **`uml/`** - fuente editable de los UML de clases (Mermaid `.mmd`).

> Nota: el **UI del visor** de archify queda en **ingles** (la herramienta solo soporta `en`/`zh-CN`); **el contenido de todos los diagramas esta en espanol**.

## A) Diagramas de comportamiento (archify)

| # | HTML | Tipo | Que muestra | Evidencia (codigo) |
|---|------|------|-------------|--------------------|
| 1 | `chain-reservas.html` | sequence | La cadena de validaciones previas a reservar clase: recorre eslabones y corta en la 1a violacion. | `m3-clases/validaciones/*`, `reservas-clases.service.ts:80` |
| 2 | `observer-cupo.html` | sequence | Al liberarse un cupo: el bus despacha el hecho a los oyentes `@OnEvent` (estado + email). | `m3-clases/observers/*`, `reservas-clases.service.ts` |
| 3 | `state-membresia.html` | lifecycle | Transiciones ACTIVA / VENCIDA / SUSPENDIDA y sus disparadores. | `m1-usuarios/entities/membresia-estado.ts` |
| 4 | `pricing-pipeline.html` | dataflow | Pipeline de precio: base -> DescuentoSocio -> RecargoHorarioPico -> precio. | `m4-canchas/pricing/tarifador-de-precios.ts` + `regla-de-precio.ts` |
| 5 | `repository-puerto.html` | architecture | Puerto (`domain/*.port.ts`) + adaptador Prisma; inversion de dependencia. | `m4-canchas/domain/reserva.port.ts`, `canchas.module.ts` |
| 6 | `facade-reserva-cancha.html` | architecture | `ReservasCanchasService.crear()` orquesta los colaboradores del caso de uso. | `m4-canchas/services/reservas-canchas.service.ts` |
| 7 | `mapa-modulos.html` | architecture | Modulos M1-M5 con los patrones aplicados y la plomeria que aporta Nest. | `src/modules`, ADR-10 |
| 8 | `reserva-lifecycle.html` | lifecycle | Ciclo de vida de la reserva de cancha: CONFIRMADA -> CUMPLIDA (derivada) / CANCELADA. | `m4-canchas/domain/reserva-estado.ts` |
| 9 | `reserva-clase-lifecycle.html` | lifecycle | Ciclo de vida de la reserva de clase: CONFIRMADA -> CUMPLIDA (derivada) / CANCELADA. | `m3-clases/domain/reserva-clase-estado.ts` |

## B) UML de clases (Mermaid)

| Fuente | PNG | Contenido |
|--------|-----|-----------|
| `chain-classes.mmd` | `png/uml-chain-classes.png` | `ValidacionDeReserva` <<interface>> + 4 eslabones + `ValidadorDeReservas` |
| `observer-classes.mmd` | `png/uml-observer-classes.png` | `EventEmitter2` (bus) + `ReservasClasesService` + 2 oyentes `@OnEvent` + `CupoLiberadoEvent` |
| `state-classes.mmd` | `png/uml-state-classes.png` | `EstadoMembresia` + ACTIVA / VENCIDA / SUSPENDIDA + `Membresia` |
| `strategy-classes.mmd` | `png/uml-strategy-classes.png` | `ReglaDePrecio` + `DescuentoSocio` / `RecargoHorarioPico` + `TarifadorDePrecios` + `ContextoDePrecio` |
| `repository-classes.mmd` | `png/uml-repository-classes.png` | `ReservaRepository` <<abstract>> + `PrismaReservaRepository` + `Reserva` |
| `facade-classes.mmd` | `png/uml-facade-classes.png` | `ReservasCanchasService` + colaboradores (repos, validador, Tarifador) |

## C) Como regenerarlos

Diagramas de comportamiento (desde la carpeta de la skill archify):

```bash
node bin/archify.mjs deliver <type> <specs/archivo.json> <html/archivo.html> --quality showcase
node bin/archify.mjs visual-check <html/archivo.html>
```

UML de clases:

```bash
npx -y @mermaid-js/mermaid-cli -i uml/<archivo>.mmd -o png/<archivo>.png -b white -s 2
```

## D) Notas de fidelidad (para la defensa)

- **Pricing** se dibuja como **Strategy/Decorator (pipeline)**, NO Composite: las reglas se acumulan sobre el mismo precio y no hay arbol.
- **Chain** es la **variante pipeline** (lista ordenada que arma el contenedor con `useFactory`); no hay `setNext()` manual.
- **State** es **sin back-reference**: el objeto de estado recibe la membresia por parametro.
- **Observer**: RF-08 usa el **bus** (`@nestjs/event-emitter` + `@OnEvent`): un hecho → N oyentes. El mismo bus lo usa el cobro interno (RF-02/RF-07) para que M1/M3 publiquen sin importar a M5 (evita el ciclo); es un uso mínimo del bus, no un patrón aparte.
- **State (reserva)**: `CUMPLIDA` se **deriva** de la fecha (no se persiste; sin cron ni migración), en cancha (`reserva-estado.ts`) y en clase (`reserva-clase-estado.ts`). Cancelar un turno o una clase ya pasada responde 409 `reserva-pasada` / `reserva-clase-pasada`.

## E) Despliegue e integración continua (Mermaid)

Exigidos por los lineamientos (5.3.2). Fuente editable en `infra/`, exportación en `png/`.

| Fuente | PNG | Contenido | Autor · fecha · versión |
|--------|-----|-----------|-------------------------|
| `infra/despliegue.mmd` | `png/despliegue.png` | **Diagrama de despliegue.** Los contenedores de Docker Compose (`db`, `migraciones`, `backend`, `frontend`), la red interna, el volumen de datos, los clientes y el puesto de control de cada sede. Muestra qué sigue funcionando si se cae la conexión principal: el service worker, la cola de ingresos offline, la lista local de inhabilitados y la resincronización al volver la red. | Vila Gonzalo · 2026-11-13 · 1.0 |
| `infra/pipeline.mmd` | `png/pipeline.png` | **Arquitectura del pipeline.** Desde el pull request hasta el despliegue en el entorno de pruebas: los cinco jobs de GitHub Actions (cuatro en paralelo y E2E después de las unitarias), la decisión de merge, la corrección en la misma rama, el artefacto de E2E y la reversión. | Vila Gonzalo · 2026-11-13 · 1.0 |

Fuentes: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.github/workflows/ci.yml`, ADR-003, ADR-007 y ADR-008.

Para regenerarlos:

```bash
npx -y @mermaid-js/mermaid-cli -i infra/despliegue.mmd -o png/despliegue.png -b white -s 2
npx -y @mermaid-js/mermaid-cli -i infra/pipeline.mmd -o png/pipeline.png -b white -s 2
```
