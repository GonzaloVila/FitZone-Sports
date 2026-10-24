# Kit de componentes de FitZone (`ui/`)

Componentes de interfaz reutilizables y sin lógica de negocio. Todo lo que se usa desde afuera sale de `ui/index.ts`.

## Niveles

| Nivel | Qué es | Qué puede conocer |
| --- | --- | --- |
| Átomos | Elementos mínimos: botón, campo de texto, insignia | Tokens semánticos y de componente |
| Moléculas | Combinación de átomos con un propósito: campo con etiqueta y error | Átomos y tokens |
| Organismos | Bloques completos: tabla, formulario, encabezado | Moléculas, átomos y tokens |
| Plantillas | Estructura de página (layouts), sin datos reales | Organismos, moléculas, átomos y tokens |
| Tokens | Variables CSS de diseño (`--fz-*`) | Solo el nivel de tokens inmediatamente inferior |

Reglas centrales:

- `ui/` **no importa nada de `features/`**. La dependencia va solo de `features/` hacia `ui/`.
- Los componentes **no conocen el dominio**: nada de "socio", "reserva", "activa", etc. Ese mapeo vive en `features/`.
- Un nivel solo usa componentes del mismo nivel o de los inferiores.

## Convenciones de nombre

- PascalCase, en español, con sufijo `Fz`: `BotonFz`, `CampoTextoFz`, `InsigniaFz`.
- Un componente por archivo `.vue` dentro de la carpeta de su nivel.

## Convenciones de API

- Variantes y tamaños como props `variante` y `tamano`, tipadas con uniones de strings (`'sm' | 'md' | 'lg'`).
- Valor editable con `v-model` usando `defineModel`.
- Eventos con nombre de acción en español: `seleccionar`, `cerrar`.
- Los atributos no declarados se reenvían al elemento nativo (`disabled`, `aria-*`, `id`, `name`...).
- El contenido se pasa por slots.
- Elementos HTML nativos siempre que se pueda, con foco visible y contraste legible.

## Íconos: `IconoFz`

Átomo decorativo con trazos propios (viewBox 24x24, `stroke="currentColor"`, trazo `--fz-icono-trazo`, `aria-hidden="true"`): toma el color del texto que lo rodea.

| Prop | Tipo | Por defecto |
| --- | --- | --- |
| `nombre` | `NombreIconoFz` (unión cerrada, se exporta desde `ui/index.ts`) | requerida |
| `tamano` | `'sm' \| 'md' \| 'lg'` (1 / 1.25 / 1.5 rem, por token `--fz-icono-tamano-*`) | `'md'` |

Nombres: `carnet`, `socios`, `acceso`, `clases`, `canchas`, `pagos`, `reportes`, `cerrar-sesion`, `menu`, `cerrar`. Para sumar uno hay que agregarlo a la unión y dibujarlo en `TRAZOS` (el tipo `Record` no deja olvidarse). Al ser decorativo, el texto accesible lo pone quien lo usa (el texto vecino o un `aria-label` en el botón).

## Plantilla de la app: `PlantillaAppFz`

Armazón de las pantallas autenticadas. Los cambios son aditivos: sin las props nuevas se comporta como siempre (barra superior).

| Prop | Tipo | Por defecto |
| --- | --- | --- |
| `disposicion` | `'barra-superior' \| 'barra-lateral'` | `'barra-superior'` |
| `etiquetaNavegacion` | `string` (`aria-label` del `<nav>`) | `'Navegación principal'` |
| `textoSaltar` | `string` | `'Saltar al contenido'` |
| `textoMenu`, `etiquetaAbrirMenu`, `etiquetaCerrarMenu` | `string` (solo `'barra-lateral'`) | `'Menú'`, `'Abrir menú'`, `'Cerrar menú'` |

Slots: `encabezado` (marca), `navegacion`, `acciones`, el slot por defecto (contenido) y, nuevo, `pie`.

- `pie`: bloque que se apoya al fondo de la barra lateral (el usuario, por ejemplo). Solo se muestra con `'barra-lateral'`.
- Con `'barra-lateral'`, desde `48rem` la barra es fija (`position: sticky`, alto `100dvh`, ancho `--fz-armazon-barra-ancho`) y el contenido queda a su derecha: el scroll lo hace la página. Debajo de `48rem` pasa a ser una barra superior con un botón "Menú" (`aria-expanded` y `aria-controls`) que muestra u oculta el panel de links. Es un desplegable, no un modal: no atrapa el foco; se cierra con Escape (devuelve el foco al botón) y al activar cualquier enlace del panel.
- En ambas disposiciones se mantienen el enlace "Saltar al contenido", el `<nav>` con `aria-label` y el foco visible por tokens; los controles miden al menos `2rem` de alto (WCAG 2.2, 2.5.8).

## Tokens

Viven en `ui/tokens/` y tienen tres niveles:

1. **Primitivos** (`--fz-prim-*`): valores crudos de la paleta y las escalas. Es el único lugar con colores literales.
2. **Semánticos** (`--fz-color-*`, `--fz-fuente-*`...): significado de cada valor. Referencian solo primitivos. Un modo oscuro se hace reasignando esta capa.
3. **De componente** (`--fz-boton-*`...): decisiones por átomo. Referencian solo semánticos.

Un componente **nunca** usa primitivos ni colores literales: solo tokens de componente o semánticos.

Los tokens los cambia solo quien lleva el kit; los demás piden el cambio.

## Cómo agregar un componente

1. Mirar `ui/index.ts` por si ya existe algo equivalente.
2. Crearlo en la carpeta de su nivel (`atomos/`, `moleculas/`, `organismos/` o `plantillas/`), respetando las convenciones de arriba.
3. Exportarlo desde `ui/index.ts`.
4. Santino lo revisa en el PR.
