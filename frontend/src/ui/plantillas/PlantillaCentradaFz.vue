<script setup lang="ts">
defineProps<{
  titulo?: string
  subtitulo?: string
}>()
</script>

<template>
  <main class="plantilla-centrada">
    <div class="plantilla-centrada__tarjeta">
      <div v-if="$slots.marca" class="plantilla-centrada__marca"><slot name="marca" /></div>
      <header v-if="titulo || subtitulo" class="plantilla-centrada__encabezado">
        <h1 v-if="titulo" class="plantilla-centrada__titulo">{{ titulo }}</h1>
        <p v-if="subtitulo" class="plantilla-centrada__subtitulo">{{ subtitulo }}</p>
      </header>
      <slot />
    </div>
  </main>
</template>

<style scoped>
.plantilla-centrada {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--fz-plantilla-centrada-relleno);
  background: var(--fz-plantilla-centrada-fondo);
}

.plantilla-centrada__tarjeta {
  width: 100%;
  max-width: var(--fz-plantilla-centrada-tarjeta-ancho-max);
  padding: var(--fz-plantilla-centrada-tarjeta-relleno);
  border: var(--fz-plantilla-centrada-tarjeta-borde-ancho) solid
    var(--fz-plantilla-centrada-tarjeta-borde);
  border-radius: var(--fz-plantilla-centrada-tarjeta-radio);
  background: var(--fz-plantilla-centrada-tarjeta-fondo);
  box-shadow: var(--fz-plantilla-centrada-tarjeta-sombra);
}

.plantilla-centrada__marca {
  margin-bottom: var(--fz-plantilla-centrada-marca-margen);
}

.plantilla-centrada__encabezado {
  display: flex;
  flex-direction: column;
  gap: var(--fz-plantilla-centrada-encabezado-separacion);
  margin-bottom: var(--fz-plantilla-centrada-encabezado-margen);
}

.plantilla-centrada__titulo,
.plantilla-centrada__subtitulo {
  margin: 0;
}

.plantilla-centrada__titulo {
  font-size: var(--fz-plantilla-centrada-titulo-texto);
  font-weight: var(--fz-plantilla-centrada-titulo-peso);
  color: var(--fz-plantilla-centrada-titulo-color);
}

.plantilla-centrada__subtitulo {
  font-size: var(--fz-plantilla-centrada-subtitulo-texto);
  color: var(--fz-plantilla-centrada-subtitulo-color);
}
</style>
