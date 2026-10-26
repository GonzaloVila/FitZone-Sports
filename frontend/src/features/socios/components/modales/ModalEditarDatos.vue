<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import type { UsuarioPatch } from '@/features/usuarios/services/servicioUsuarios'
import { AvisoFz, BotonFz, CampoFormularioFz, ModalFz } from '@/ui'
import {
  cambiosDeDatos,
  erroresDeDatos,
  hayCambios,
  type CampoEditable,
  type DatosEditables,
  type ErroresEdicion,
} from '../../edicionDatos'

const props = defineProps<{
  // Los valores actuales del usuario: de ahí se calculan los campos que cambiaron.
  original: DatosEditables
  ejecutando: boolean
  // Error general del servidor y errores por campo (un 422), siempre dentro del modal.
  error: string | null
  errores: ErroresEdicion
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ confirmar: [cambios: UsuarioPatch] }>()

const idFormulario = useId()
const editado = reactive<DatosEditables>({ ...props.original })
// Un error del servidor sobre un campo se oculta apenas se lo vuelve a editar, hasta el próximo envío.
const tocado = reactive<Record<CampoEditable, boolean>>({ nombre: false, telefono: false })

watch(abierto, (valor) => {
  if (!valor) return
  Object.assign(editado, props.original)
  tocado.nombre = tocado.telefono = false
})
watch(
  () => props.errores,
  () => {
    tocado.nombre = tocado.telefono = false
  },
)
watch(
  () => editado.nombre,
  () => (tocado.nombre = true),
)
watch(
  () => editado.telefono,
  () => (tocado.telefono = true),
)

const cambios = computed(() => cambiosDeDatos(props.original, editado))
const errorNombre = computed(() => erroresDeDatos(editado).nombre ?? (tocado.nombre ? undefined : props.errores.nombre))
const errorTelefono = computed(() => (tocado.telefono ? undefined : props.errores.telefono))
const puedeGuardar = computed(() => hayCambios(cambios.value) && !erroresDeDatos(editado).nombre)

function confirmar() {
  if (puedeGuardar.value && !props.ejecutando) emit('confirmar', cambios.value)
}
</script>

<template>
  <ModalFz v-model="abierto" titulo="Editar datos" icono="editar" tono="primario" :ocupado="ejecutando">
    <form :id="idFormulario" class="formulario" novalidate @submit.prevent="confirmar">
      <fieldset class="campos" :disabled="ejecutando">
        <CampoFormularioFz
          v-model="editado.nombre"
          etiqueta="Nombre y apellido"
          etiqueta-chica
          obligatorio
          name="nombre"
          autocomplete="name"
          :error="errorNombre"
        />
        <CampoFormularioFz
          v-model="editado.telefono"
          etiqueta="Teléfono (opcional)"
          etiqueta-chica
          tipo="tel"
          name="telefono"
          autocomplete="off"
          :error="errorTelefono"
        />
      </fieldset>
      <p class="ayuda">El DNI y el correo no se pueden cambiar desde acá.</p>
    </form>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="ejecutando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="ejecutando" :disabled="!puedeGuardar">Guardar cambios</BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.campos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}

.ayuda {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-minimo);
}
</style>
