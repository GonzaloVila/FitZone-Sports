<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AvisoFz, BotonFz } from '@/ui'
import FormularioSede from '../components/FormularioSede.vue'
import { useAltaSede } from '../composables/useAltaSede'

const router = useRouter()

const {
  form,
  guardando,
  error,
  erroresValidacion,
  sedeCreada,
  crear,
  reiniciar,
} = useAltaSede({
  alExito: (sede) => {
    // Redirigir a aforo después de 1.5 segundos o permitir al usuario seguir
    setTimeout(() => {
      void router.push('/acceso/aforo')
    }, 1500)
  },
})
</script>

<template>
  <div class="alta-sede-page">
    <header class="alta-sede-page__encabezado">
      <div>
        <h1 class="alta-sede-page__titulo">Nueva Sede / Sucursal</h1>
        <p class="alta-sede-page__subtitulo">
          Da de alta una nueva sede de la cadena sin requerir cambios en el código (RNF-04).
        </p>
      </div>

      <BotonFz variante="secundario" @click="router.back()">
        Volver
      </BotonFz>
    </header>

    <div v-if="error" class="alta-sede-page__alerta">
      <AvisoFz variante="peligro">{{ error }}</AvisoFz>
    </div>

    <div v-if="sedeCreada" class="alta-sede-page__alerta">
      <AvisoFz variante="exito">
        ¡Sede <strong>{{ sedeCreada.nombre }}</strong> creada con éxito! Capacidad: {{ sedeCreada.aforoMaximo }} personas. Redirigiendo a la pantalla de aforo…
      </AvisoFz>
    </div>

    <FormularioSede
      v-if="!sedeCreada"
      :form="form"
      :guardando="guardando"
      :errores="erroresValidacion"
      @guardar="crear"
    />
  </div>
</template>

<style scoped>
.alta-sede-page {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-amplio);
  max-width: 40rem;
  margin: 0 auto;
  width: 100%;
}

.alta-sede-page__encabezado {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--fz-espaciado-base);
  flex-wrap: wrap;
}

.alta-sede-page__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.alta-sede-page__subtitulo {
  margin: var(--fz-espaciado-minimo) 0 0;
  color: var(--fz-color-texto-suave);
}

.alta-sede-page__alerta {
  width: 100%;
}
</style>
