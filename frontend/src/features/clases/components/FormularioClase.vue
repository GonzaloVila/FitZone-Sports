<script setup lang="ts">
import { CampoFormularioFz, SelectFz } from '@/ui'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import type { FormularioClaseDatos } from '../tipos'

defineProps<{
  form: FormularioClaseDatos
  sedes: Sede[]
  guardando: boolean
  errores: Record<string, string>
  // RECEPCION trabaja en su sede: el select queda fijo.
  sedeBloqueada?: boolean
  // Id del <form>: los botones del pie del modal lo envían con el atributo `form`.
  idFormulario: string
}>()

defineEmits<{
  (e: 'guardar'): void
}>()
</script>

<template>
  <form :id="idFormulario" class="formulario-clase" novalidate @submit.prevent="$emit('guardar')">
    <CampoFormularioFz etiqueta="Sede" etiqueta-chica obligatorio :error="errores.sedeId">
      <template #default="{ id, describedby, invalido }">
        <SelectFz
          :id="id"
          v-model="form.sedeId"
          name="sedeId"
          aria-required="true"
          :invalido="invalido"
          :aria-describedby="describedby"
          :disabled="guardando || sedeBloqueada"
        >
          <option value="" disabled>Elegí una sede</option>
          <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
        </SelectFz>
      </template>
    </CampoFormularioFz>

    <CampoFormularioFz
      v-model="form.tipo"
      etiqueta="Disciplina"
      etiqueta-chica
      obligatorio
      name="tipo"
      placeholder="Ej: Spinning, Yoga"
      autocomplete="off"
      :error="errores.tipo"
      :disabled="guardando"
    />

    <CampoFormularioFz
      v-model="form.instructor"
      etiqueta="Instructor"
      etiqueta-chica
      obligatorio
      name="instructor"
      autocomplete="off"
      :error="errores.instructor"
      :disabled="guardando"
    />

    <CampoFormularioFz
      v-model="form.dia"
      etiqueta="Día"
      etiqueta-chica
      obligatorio
      tipo="date"
      name="dia"
      :error="errores.dia"
      :disabled="guardando"
    />

    <div class="formulario-clase__horario">
      <CampoFormularioFz
        v-model="form.horaInicio"
        etiqueta="Hora de inicio"
        etiqueta-chica
        obligatorio
        tipo="time"
        name="horaInicio"
        :error="errores.horaInicio"
        :disabled="guardando"
      />
      <CampoFormularioFz
        v-model="form.horaFin"
        etiqueta="Hora de fin"
        etiqueta-chica
        obligatorio
        tipo="time"
        name="horaFin"
        :error="errores.horaFin"
        :disabled="guardando"
      />
    </div>
    <!-- El 409 "fuera de horario" del servidor se muestra junto a los campos de horario. -->
    <p v-if="errores.horario" class="formulario-clase__error" role="alert">{{ errores.horario }}</p>

    <CampoFormularioFz
      v-model="form.capacidad"
      etiqueta="Cupo"
      etiqueta-chica
      obligatorio
      tipo="number"
      name="capacidad"
      min="1"
      step="1"
      ayuda="Cantidad máxima de socios en la clase."
      :error="errores.capacidad"
      :disabled="guardando"
    />
  </form>
</template>

<style scoped>
.formulario-clase {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.formulario-clase__horario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--fz-espaciado-base);
}

.formulario-clase__error {
  margin: 0;
  color: var(--fz-color-peligro);
  font-size: var(--fz-texto-pequeno);
}
</style>
