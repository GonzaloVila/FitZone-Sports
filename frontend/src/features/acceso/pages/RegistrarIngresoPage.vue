<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, EncabezadoPaginaFz } from '@/ui'
import FormularioIngreso from '../components/FormularioIngreso.vue'
import ResultadoIngreso from '../components/ResultadoIngreso.vue'
import { useRegistroIngreso } from '../composables/useRegistroIngreso'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const esGerente = computed(() => rol.value === 'GERENTE')

const { sedes, cargando: cargandoSedes, error: errorSedes } = useSedes()

const sedeSeleccionada = ref<number | null>(sedeUsuario.value ?? null)

watch(
  () => sedeUsuario.value,
  (val) => {
    if (!esGerente.value && val) {
      sedeSeleccionada.value = val
    }
  },
  { immediate: true },
)

watch(
  sedes,
  (lista) => {
    if (esGerente.value && !sedeSeleccionada.value && lista.length > 0 && lista[0]) {
      sedeSeleccionada.value = lista[0].id
    }
  },
  { immediate: true },
)

// El formulario trabaja con el valor del select (texto); la sede elegida se guarda como número.
const sedeTexto = computed({
  get: () => (sedeSeleccionada.value ? String(sedeSeleccionada.value) : ''),
  set: (valor: string) => {
    sedeSeleccionada.value = valor ? Number(valor) : null
  },
})

const {
  socioIdInput,
  codigoTotpInput,
  procesando,
  resultado,
  registrar,
} = useRegistroIngreso(sedeSeleccionada)
</script>

<template>
  <section class="registrar-ingreso">
    <EncabezadoPaginaFz
      titulo="Registrar ingreso"
      subtitulo="Validá la membresía de un socio y dejá registrado su ingreso."
      :volver="{ texto: 'Volver al aforo', a: { name: 'acceso-aforo' } }"
    />

    <AvisoFz v-if="errorSedes" variante="peligro">{{ errorSedes }}</AvisoFz>

    <FormularioIngreso
      v-model:sede-id="sedeTexto"
      v-model:socio-id="socioIdInput"
      v-model:codigo-totp="codigoTotpInput"
      :con-selector-sede="esGerente"
      :sedes="sedes"
      :cargando-sedes="cargandoSedes"
      :procesando="procesando"
      :bloqueado="!sedeSeleccionada"
      @enviar="registrar"
    />

    <ResultadoIngreso :resultado="resultado" />
  </section>
</template>

<style scoped>
/* Pantalla de tarea: una columna centrada del mismo ancho que las demás pantallas de tarea. */
.registrar-ingreso {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
  max-width: 32rem;
  margin-inline: auto;
}
</style>
