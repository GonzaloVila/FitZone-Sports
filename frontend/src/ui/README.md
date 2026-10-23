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
