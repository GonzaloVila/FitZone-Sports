<script setup lang="ts">
import { BotonFz, CampoFormularioFz, SelectFz } from '@/ui'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import type { FormularioClaseDatos } from '../tipos'

defineProps<{
  form: FormularioClaseDatos
  sedes: Sede[]
  guardando: boolean
  errores: Record<string, string>
  // RECEPCION trabaja en su sede: el select queda fijo.
  sedeBloqueada?: boolean
}>()

defineEmits<{
  (e: 'guardar'): void
}>()
</script>

<template>
  <form class="formulario-clase" novalidate @submit.prevent="$emit('guardar')">
    <div class="formulario-clase__campo">
      <label for="clase-sede" class="formulario-clase__etiqueta">Sede</label>
      <SelectFz
        id="clase-sede"
        v-model="form.sedeId"
        name="sedeId"
        :invalido="Boolean(errores.sedeId)"
        :aria-describedby="errores.sedeId ? 'clase-sede-error' : undefined"
        :disabled="guardando || sedeBloqueada"
        required
      >
        <option value="" disabled>Elegí una sede</option>
        <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
      </SelectFz>
      <p v-if="errores.sedeId" id="clase-sede-error" class="formulario-clase__error" role="alert">{{ errores.sedeId }}</p>
    </div>

    <CampoFormularioFz
      v-model="form.tipo"
      etiqueta="Disciplina"
      name="tipo"
      ayuda="Ej: Spinning, Yoga"
      :error="errores.tipo"
      :disabled="guardando"
      required
    />

    <CampoFormularioFz
      v-model="form.instructor"
      etiqueta="Instructor"
      name="instructor"
      :error="errores.instructor"
      :disabled="guardando"
      required
    />

    <CampoFormularioFz
      v-model="form.dia"
      etiqueta="Día"
      tipo="date"
      name="dia"
      :error="errores.dia"
      :disabled="guardando"
      required
    />

    <div class="formulario-clase__horario">
      <CampoFormularioFz
        v-model="form.horaInicio"
        etiqueta="Hora de inicio"
        tipo="time"
        name="horaInicio"
        :error="errores.horaInicio"
        :disabled="guardando"
        required
      />
      <CampoFormularioFz
        v-model="form.horaFin"
        etiqueta="Hora de fin"
        tipo="time"
        name="horaFin"
        :error="errores.horaFin"
        :disabled="guardando"
        required
      />
    </div>
    <!-- El 409 "fuera de horario" del servidor se muestra junto a los campos de horario. -->
    <p v-if="errores.horario" class="formulario-clase__error" role="alert">{{ errores.horario }}</p>

    <CampoFormularioFz
      v-model="form.capacidad"
      etiqueta="Cupo"
      tipo="number"
      name="capacidad"
      min="1"
      step="1"
      ayuda="Cantidad máxima de socios en la clase"
      :error="errores.capacidad"
      :disabled="guardando"
      required
    />

    <div class="formulario-clase__acciones">
      <BotonFz variante="primario" tipo="submit" :cargando="guardando">
        {{ guardando ? 'Creando clase…' : 'Crear clase' }}
      </BotonFz>
    </div>
  </form>
</template>

<style scoped>
.formulario-clase {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-amplio);
  max-width: 32rem;
  background: var(--fz-color-superficie);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  box-shadow: var(--fz-sombra-tarjeta);
}

.formulario-clase__campo {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.formulario-clase__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.formulario-clase__horario {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--fz-espaciado-base);
}

.formulario-clase__error {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-peligro);
}

.formulario-clase__acciones {
  display: flex;
  justify-content: flex-end;
}
</style>
