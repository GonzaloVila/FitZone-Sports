<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz } from '@/ui'
import FormularioClase from '../components/FormularioClase.vue'
import { useAltaClase } from '../composables/useAltaClase'

const router = useRouter()
const { sedeId } = useUsuarioSesion()
const { sedes, error: errorSedes } = useSedes()

const { form, guardando, error, errores, crear } = useAltaClase({
  alExito: (clase) => void router.push({ name: 'clase-detalle', params: { claseId: clase.id } }),
})

// RECEPCION tiene sede fija; el GERENTE (sedeId null) elige.
const sedeBloqueada = computed(() => sedeId.value !== null)
</script>

<template>
  <section class="alta-clase">
    <RouterLink :to="{ name: 'clases' }" class="alta-clase__volver">← Volver a la agenda</RouterLink>

    <header class="alta-clase__encabezado">
      <h1 class="alta-clase__titulo">Nueva clase</h1>
      <p class="alta-clase__subtitulo">Cargá una clase grupal con su sede, instructor, horario y cupo.</p>
    </header>

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <FormularioClase
      :form="form"
      :sedes="sedes"
      :guardando="guardando"
      :errores="errores"
      :sede-bloqueada="sedeBloqueada"
      @guardar="crear"
    />
  </section>
</template>

<style scoped>
.alta-clase {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 40rem;
  margin: 0 auto;
  width: 100%;
}

.alta-clase__volver {
  align-self: flex-start;
  color: var(--fz-color-primario);
  font-size: var(--fz-texto-pequeno);
}

.alta-clase__volver:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.alta-clase__encabezado {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.alta-clase__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.alta-clase__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}
</style>
