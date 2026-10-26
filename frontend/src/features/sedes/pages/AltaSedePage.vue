<script setup lang="ts">
import { useRouter } from 'vue-router'
import { EncabezadoPaginaFz, useAvisosFz } from '@/ui'
import FormularioSede from '../components/FormularioSede.vue'
import { useAltaSede } from '../composables/useAltaSede'

const router = useRouter()
const avisos = useAvisosFz()

// Al crear la sede se avisa con un aviso flotante y se vuelve al aforo.
const { form, guardando, error, erroresValidacion, crear } = useAltaSede({
  alExito: (sede) => {
    avisos.exito('Sede creada', `${sede.nombre} · capacidad para ${sede.aforoMaximo} personas.`)
    void router.push({ name: 'acceso-aforo' })
  },
})

function volverAlAforo() {
  void router.push({ name: 'acceso-aforo' })
}
</script>

<template>
  <section class="alta-sede">
    <EncabezadoPaginaFz
      titulo="Nueva sede"
      subtitulo="Cargá los datos de la sede."
      :volver="{ texto: 'Volver al aforo', a: { name: 'acceso-aforo' } }"
    />

    <FormularioSede
      :form="form"
      :guardando="guardando"
      :errores="erroresValidacion"
      :error="error"
      @guardar="crear"
      @cancelar="volverAlAforo"
    />
  </section>
</template>

<style scoped>
/* Pantalla de tarea: una columna centrada del mismo ancho que las demás pantallas de tarea. */
.alta-sede {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
  max-width: 32rem;
  margin-inline: auto;
}
</style>
